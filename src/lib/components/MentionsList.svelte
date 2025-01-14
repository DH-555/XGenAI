<script lang="ts">
  import { onMount } from 'svelte';
  import type { TweetV2, UserV2 } from '$lib/types/twitter';
  import { rateLimit } from '$lib/stores/rateLimit';
  import { generateReply } from '$lib/utils/gemini';
  import { DatabaseService } from '$lib/appwrite/database';
  import { ID } from 'appwrite';

  export let accessToken: string;
  
  let loading = true;
  let error = '';
  let mentions: TweetV2[] = [];
  let users: Record<string, UserV2> = {};
  let timeUntilReset = '';

  // Increase cache duration to reduce API calls
  const CACHE_KEY = 'twitter_mentions_cache';
  const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  // Add rate limit cache
  const RATE_LIMIT_KEY = 'twitter_rate_limit';

  let rateLimitInfo = {
    remaining: 0,
    limit: 0,
    reset: 0,
    resetDate: ''
  };

  // Check if we're rate limited from cache
  const checkRateLimit = () => {
    const cached = localStorage.getItem(RATE_LIMIT_KEY);
    if (cached) {
      const { reset, isLimited } = JSON.parse(cached);
      if (reset > Date.now() / 1000) {
        $rateLimit.isLimited = isLimited;
        $rateLimit.reset = reset;
        return true;
      } else {
        localStorage.removeItem(RATE_LIMIT_KEY);
      }
    }
    return false;
  };

  // Save rate limit info to cache
  const saveRateLimit = (reset: number) => {
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({
      reset,
      isLimited: true
    }));
  };

  // Load cached data
  const loadCache = () => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        mentions = data.mentions;
        users = data.users;
        return true;
      }
    }
    return false;
  };

  // Save to cache
  const saveToCache = (data: any) => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  };

  // Update countdown timer
  const updateCountdown = () => {
    const reset = $rateLimit.reset * 1000; // Convert to milliseconds
    const now = Date.now();
    const diff = reset - now;
    
    if (diff > 0) {
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      timeUntilReset = `${minutes}m ${seconds}s`;
      setTimeout(updateCountdown, 1000);
    } else {
      timeUntilReset = '';
      $rateLimit.isLimited = false;
      localStorage.removeItem(RATE_LIMIT_KEY);
    }
  };

  let fetchPromise: Promise<void> | null = null;

  let usingMockData = false;

  const fetchMentions = async () => {
    if (fetchPromise) return fetchPromise;

    fetchPromise = (async () => {
      try {
        const response = await fetch('/api/twitter/mentions', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        // Check if we're using mock data
        usingMockData = response.headers.get('X-Using-Mock-Data') === 'true';
        if (usingMockData) {
          console.log('📝 Using mock data for mentions');
        }

        // Handle rate limiting
        if (response.status === 429) {
          const reset = parseInt(response.headers.get('x-rate-limit-reset') || '0');
          $rateLimit.isLimited = true;
          $rateLimit.reset = reset;
          saveRateLimit(reset);
          updateCountdown();
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to fetch mentions');
        }

        const data = await response.json();
        mentions = data.data || [];
        users = data.includes?.users?.reduce((acc: Record<string, UserV2>, user: UserV2) => {
          if (user.id) {
            acc[user.id] = user;
          }
          return acc;
        }, {}) || {};

        saveToCache({ mentions, users });
      } catch (e) {
        error = e instanceof Error ? e.message : 'Failed to load mentions';
        console.error('Error loading mentions:', e);
      } finally {
        loading = false;
        fetchPromise = null;
      }
    })();

    return fetchPromise;
  };

  const shouldFetch = () => {
    const cached = localStorage.getItem('twitter_rate_limit');
    if (cached) {
        const { isLimited, reset, lastChecked } = JSON.parse(cached);
        if (isLimited && Date.now() < reset * 1000) {
            return false;
        }
    }
    return true;
  };

  onMount(async () => {
    if (!shouldFetch()) {
        loading = false;
        loadCache();
        return;
    }

    // Check rate limit first
    if (checkRateLimit()) {
      updateCountdown();
      loading = false;
      // Try to load cached data if available
      loadCache();
      return;
    }

    // Load cached data first
    const hasCachedData = loadCache();
    if (hasCachedData) {
      loading = false;
    }

    // Only fetch if not rate limited
    if (!$rateLimit.isLimited) {
      await fetchMentions();
    }

    // Load existing responses
    if (mentions.length > 0) {
      for (const mention of mentions) {
        const responses = await DatabaseService.getResponsesForTweet(mention.id);
        if (responses.documents.length > 0) {
          generatedReplies[mention.id] = responses.documents.map(doc => ({
            id: doc.$id,
            content: doc.content,
            generated_at: doc.generated_at,
            model: doc.model
          }));
        }
      }
    }
  });

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  let generatingReply: Record<string, boolean> = {};
  let generatedReplies: Record<string, TweetResponse[]> = {};

  interface TweetResponse {
    id: string;
    content: string;
    generated_at: string;
    model: string;
    posted?: boolean;
  }

  let postingReply: Record<string, boolean> = {};

  async function handleGenerateReply(tweet: TweetV2) {
    try {
        generatingReply[tweet.id] = true;

        // Check if tweet exists before saving
        const tweetExists = await DatabaseService.checkTweetExists(tweet.id);
        
        if (!tweetExists) {
            await DatabaseService.saveTweet({
                tweet_id: tweet.id,
                author_id: tweet.author_id || '',
                author_username: tweet.author_id && users[tweet.author_id] 
                    ? users[tweet.author_id].username 
                    : 'unknown',
                content: tweet.text,
                created_at: tweet.created_at || new Date().toISOString()
            });
        }

        // Generate the reply
        const reply = await generateReply(tweet.text);
        const timestamp = new Date().toISOString();
        
        // Save the response without an id field
        const savedResponse = await DatabaseService.saveResponse({
            tweet_id: tweet.id,
            content: reply,
            generated_at: timestamp,
            model: 'gemini-1.5-flash',
            posted: false
        });

        // Create response object using the Appwrite-generated ID
        const newResponse = {
            id: savedResponse.$id,
            content: reply,
            generated_at: timestamp,
            model: 'gemini-1.5-flash'
        };

        // Initialize array if it doesn't exist
        if (!generatedReplies[tweet.id]) {
            generatedReplies[tweet.id] = [];
        }
        
        // Add new response to the array
        generatedReplies[tweet.id] = [newResponse, ...generatedReplies[tweet.id]];

    } catch (error) {
        console.error('Failed to generate reply:', error);
    } finally {
        generatingReply[tweet.id] = false;
    }
  }

  async function handlePostReply(tweet: TweetV2, reply: TweetResponse) {
    try {
        postingReply[`${tweet.id}-${reply.id}`] = true;
        
        // Call Twitter API to post the reply
        const response = await fetch('/api/twitter/reply', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                in_reply_to_tweet_id: tweet.id,
                text: reply.content
            })
        });

        if (!response.ok) {
            throw new Error('Failed to post reply');
        }

        // Update the response status in database
        await DatabaseService.updateResponseStatus(reply.id, true);

        // Update the local state
        generatedReplies[tweet.id] = generatedReplies[tweet.id].map(r => 
            r.id === reply.id ? { ...r, posted: true } : r
        );

    } catch (error) {
        console.error('Failed to post reply:', error);
        throw error;
    } finally {
        postingReply[`${tweet.id}-${reply.id}`] = false;
    }
  }
</script>

<div class="mentions-list p-6">
  <h3 class="text-2xl font-bold text-white mb-8">Recent Mentions</h3>
  
  <div class="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 mb-6">
    <p class="text-white/60">API Calls Remaining: {rateLimitInfo.remaining}/{rateLimitInfo.limit}</p>
    <p class="text-white/60">Reset at: {rateLimitInfo.resetDate}</p>
  </div>
  
  {#if $rateLimit.isLimited}
    <div class="bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-4 mb-6">
      <p class="text-yellow-400">Rate limit exceeded. Please wait {timeUntilReset} before trying again.</p>
      {#if mentions.length > 0}
        <p class="text-white/40 text-sm mt-2">Showing cached data</p>
      {/if}
    </div>
  {/if}
  
  {#if loading}
    <div class="flex flex-col items-center justify-center py-12">
      <div class="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p class="text-white/60">Loading mentions...</p>
    </div>
  {:else if error}
    <div class="bg-red-500/5 border border-red-500/10 rounded-xl p-4 text-center text-red-400">
      <p>{error}</p>
    </div>
  {:else if mentions.length === 0}
    <div class="text-center py-12">
      <p class="text-white/60">No recent mentions found</p>
    </div>
  {:else}
    <div class="space-y-6">
      {#each mentions as mention}
        <div class="bg-[#0C1322] border border-blue-500/10 rounded-xl p-6 hover:border-blue-500/20 transition-all duration-300">
          <div class="flex justify-between items-center mb-4">
            <span class="text-blue-400 font-medium">
              {#if mention.author_id && users[mention.author_id]}
                @{users[mention.author_id].username}
              {:else}
                @unknown
              {/if}
            </span>
            <span class="text-white/40 text-sm">{formatDate(mention.created_at)}</span>
          </div>
          
          <p class="text-white/80 mb-6">{mention.text}</p>
          
          {#if generatedReplies[mention.id]}
            <div class="space-y-4 bg-blue-500/5 border border-blue-500/10 rounded-lg p-4 mb-4">
              <p class="text-sm text-blue-400">Generated Replies:</p>
              {#each generatedReplies[mention.id] as reply}
                <div class="border-t border-blue-500/10 pt-3 first:border-t-0 first:pt-0">
                  <p class="text-white/80">{reply.content}</p>
                  <div class="flex justify-between items-center mt-2">
                    <p class="text-xs text-white/40">
                      Generated: {new Date(reply.generated_at).toLocaleString()}
                    </p>
                    <button 
                      class="bg-green-500 hover:bg-green-600 text-white px-4 py-1 rounded-full text-xs font-medium transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
                      on:click={() => handlePostReply(mention, reply)}
                      disabled={postingReply[`${mention.id}-${reply.id}`] || reply.posted}
                    >
                      {#if postingReply[`${mention.id}-${reply.id}`]}
                        <div class="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        Posting...
                      {:else if reply.posted}
                        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                        </svg>
                        Posted
                      {:else}
                        Post Reply
                      {/if}
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          <div class="flex justify-end">
            <button 
              class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
              on:click={() => handleGenerateReply(mention)}
              disabled={generatingReply[mention.id]}
            >
              {#if generatingReply[mention.id]}
                <span class="flex items-center gap-2">
                  <div class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  Generating...
                </span>
              {:else}
                Generate Reply
              {/if}
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if usingMockData}
    <div class="mt-6 bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 text-center">
      <p class="text-blue-400">Using demo data - Rate limit will reset soon</p>
    </div>
  {/if}
</div>

<style>
  .mentions-list {
    margin-top: 2rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style> 