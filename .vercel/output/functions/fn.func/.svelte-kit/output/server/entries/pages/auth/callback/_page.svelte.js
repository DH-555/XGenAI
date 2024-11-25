import { c as create_ssr_component, a as escape } from "../../../../chunks/vendor.js";
import "../../../../chunks/appwrite.js";
const css = {
  code: ".loading.svelte-1x64zeq,.error-container.svelte-1x64zeq{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:1rem;padding:1rem;text-align:center}.error.svelte-1x64zeq{color:#ff4444;font-weight:bold;font-size:1.2rem}.error-details.svelte-1x64zeq{color:#666;max-width:400px}.back-button.svelte-1x64zeq{display:inline-block;color:white;background-color:#1DA1F2;text-decoration:none;padding:0.75rem 1.5rem;border-radius:25px;margin-top:1rem;transition:background-color 0.2s}.back-button.svelte-1x64zeq:hover{background-color:#1a8cd8}.spinner.svelte-1x64zeq{width:40px;height:40px;border:4px solid #f3f3f3;border-top:4px solid #1DA1F2;border-radius:50%;animation:svelte-1x64zeq-spin 1s linear infinite;margin-bottom:1rem}@keyframes svelte-1x64zeq-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}",
  map: '{"version":3,"file":"+page.svelte","sources":["+page.svelte"],"sourcesContent":["<script lang=\\"ts\\">import { twitterClient } from \\"$lib/twitter\\";\\nimport { createDocument, findUserByTwitterId, updateDocument, createAnonymousSession, getCurrentSession } from \\"$lib/appwrite\\";\\nimport { goto } from \\"$app/navigation\\";\\nimport { twitterUser } from \\"$lib/stores/twitter\\";\\nimport { onMount } from \\"svelte\\";\\nlet loading = true;\\nlet error = \\"\\";\\nlet message = \\"Setting up your account...\\";\\nonMount(async () => {\\n  try {\\n    message = \\"Checking session...\\";\\n    let session = await getCurrentSession();\\n    if (!session) {\\n      message = \\"Initializing session...\\";\\n      session = await createAnonymousSession();\\n      if (!session) {\\n        throw new Error(\\"Failed to create session\\");\\n      }\\n    }\\n    const urlParams = new URLSearchParams(window.location.search);\\n    const code = urlParams.get(\\"code\\");\\n    const state = urlParams.get(\\"state\\");\\n    if (!code || !state) {\\n      throw new Error(\\"Missing required OAuth parameters\\");\\n    }\\n    message = \\"Verifying Twitter credentials...\\";\\n    const { user: twitterUserData, accessToken, refreshToken } = await twitterClient.handleCallback(code, state);\\n    message = \\"Checking existing account...\\";\\n    const existingUser = await findUserByTwitterId(twitterUserData.username ?? \\"\\");\\n    if (existingUser) {\\n      message = \\"Updating your account...\\";\\n      await updateDocument(existingUser.$id, {\\n        lastLogin: (/* @__PURE__ */ new Date()).toISOString(),\\n        accessToken,\\n        refreshToken: refreshToken || void 0,\\n        name: twitterUserData.name ?? \\"\\"\\n      });\\n    } else {\\n      message = \\"Creating your account...\\";\\n      await createDocument({\\n        userId: twitterUserData.id,\\n        twitterId: twitterUserData.username ?? \\"\\",\\n        createdAt: (/* @__PURE__ */ new Date()).toISOString(),\\n        lastLogin: (/* @__PURE__ */ new Date()).toISOString(),\\n        accessToken,\\n        refreshToken: refreshToken || void 0,\\n        name: twitterUserData.name ?? \\"\\",\\n        username: twitterUserData.username ?? \\"\\"\\n      });\\n    }\\n    twitterUser.set(twitterUserData);\\n    message = \\"Redirecting to dashboard...\\";\\n    await goto(\\"/dashboard\\");\\n  } catch (err) {\\n    error = err instanceof Error ? err.message : \\"Authentication failed\\";\\n    console.error(\\"Callback error:\\", err);\\n  } finally {\\n    loading = false;\\n  }\\n});\\n<\/script>\\n\\n{#if error}\\n  <div class=\\"error-container\\">\\n    <p class=\\"error\\">{error}</p>\\n    <p class=\\"error-details\\">Something went wrong during authentication.</p>\\n    <a href=\\"/login\\" class=\\"back-button\\">Back to Login</a>\\n  </div>\\n{:else if loading}\\n  <div class=\\"loading\\">\\n    <div class=\\"spinner\\"></div>\\n    <p>{message}</p>\\n  </div>\\n{/if}\\n\\n<style>\\n  .loading,\\n  .error-container {\\n    display: flex;\\n    flex-direction: column;\\n    align-items: center;\\n    justify-content: center;\\n    min-height: 100vh;\\n    gap: 1rem;\\n    padding: 1rem;\\n    text-align: center;\\n  }\\n\\n  .error {\\n    color: #ff4444;\\n    font-weight: bold;\\n    font-size: 1.2rem;\\n  }\\n\\n  .error-details {\\n    color: #666;\\n    max-width: 400px;\\n  }\\n\\n  .back-button {\\n    display: inline-block;\\n    color: white;\\n    background-color: #1DA1F2;\\n    text-decoration: none;\\n    padding: 0.75rem 1.5rem;\\n    border-radius: 25px;\\n    margin-top: 1rem;\\n    transition: background-color 0.2s;\\n  }\\n\\n  .back-button:hover {\\n    background-color: #1a8cd8;\\n  }\\n\\n  .spinner {\\n    width: 40px;\\n    height: 40px;\\n    border: 4px solid #f3f3f3;\\n    border-top: 4px solid #1DA1F2;\\n    border-radius: 50%;\\n    animation: spin 1s linear infinite;\\n    margin-bottom: 1rem;\\n  }\\n\\n  @keyframes spin {\\n    0% { transform: rotate(0deg); }\\n    100% { transform: rotate(360deg); }\\n  }\\n</style> "],"names":[],"mappings":"AA4EE,uBAAQ,CACR,+BAAiB,CACf,OAAO,CAAE,IAAI,CACb,cAAc,CAAE,MAAM,CACtB,WAAW,CAAE,MAAM,CACnB,eAAe,CAAE,MAAM,CACvB,UAAU,CAAE,KAAK,CACjB,GAAG,CAAE,IAAI,CACT,OAAO,CAAE,IAAI,CACb,UAAU,CAAE,MACd,CAEA,qBAAO,CACL,KAAK,CAAE,OAAO,CACd,WAAW,CAAE,IAAI,CACjB,SAAS,CAAE,MACb,CAEA,6BAAe,CACb,KAAK,CAAE,IAAI,CACX,SAAS,CAAE,KACb,CAEA,2BAAa,CACX,OAAO,CAAE,YAAY,CACrB,KAAK,CAAE,KAAK,CACZ,gBAAgB,CAAE,OAAO,CACzB,eAAe,CAAE,IAAI,CACrB,OAAO,CAAE,OAAO,CAAC,MAAM,CACvB,aAAa,CAAE,IAAI,CACnB,UAAU,CAAE,IAAI,CAChB,UAAU,CAAE,gBAAgB,CAAC,IAC/B,CAEA,2BAAY,MAAO,CACjB,gBAAgB,CAAE,OACpB,CAEA,uBAAS,CACP,KAAK,CAAE,IAAI,CACX,MAAM,CAAE,IAAI,CACZ,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,OAAO,CACzB,UAAU,CAAE,GAAG,CAAC,KAAK,CAAC,OAAO,CAC7B,aAAa,CAAE,GAAG,CAClB,SAAS,CAAE,mBAAI,CAAC,EAAE,CAAC,MAAM,CAAC,QAAQ,CAClC,aAAa,CAAE,IACjB,CAEA,WAAW,mBAAK,CACd,EAAG,CAAE,SAAS,CAAE,OAAO,IAAI,CAAG,CAC9B,IAAK,CAAE,SAAS,CAAE,OAAO,MAAM,CAAG,CACpC"}'
};
const Page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let message = "Setting up your account...";
  $$result.css.add(css);
  return `${`${`<div class="loading svelte-1x64zeq"><div class="spinner svelte-1x64zeq"></div> <p>${escape(message)}</p></div>`}`}`;
});
export {
  Page as default
};