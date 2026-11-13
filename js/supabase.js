const PTB_SUPABASE_URL = "https://wmxlpxvxmdsqouqgihvp.supabase.co";
const PTB_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_SJ0GpEhs-HFypfu3AWg16w_Hsx2wm4U";
const PTB_SUPABASE_SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

window.ptbSupabase = null;
let ptbSupabasePromise = null;
let ptbSupabaseSdkPromise = null;

function loadPTBSupabaseSdk() {
  if (window.supabase?.createClient) return Promise.resolve();
  if (ptbSupabaseSdkPromise) return ptbSupabaseSdkPromise;

  ptbSupabaseSdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PTB_SUPABASE_SDK_URL;
    script.async = true;
    script.onload = () => {
      if (window.supabase?.createClient) {
        resolve();
      } else {
        reject(new Error("The Supabase client library loaded without its createClient API."));
      }
    };
    script.onerror = () => reject(new Error("Could not load the Supabase client library."));
    document.head.appendChild(script);
  });

  return ptbSupabaseSdkPromise;
}

window.connectPTBSupabase = function connectPTBSupabase() {
  if (window.ptbSupabase) return Promise.resolve(window.ptbSupabase);
  if (ptbSupabasePromise) return ptbSupabasePromise;

  if (
    PTB_SUPABASE_URL.startsWith("PASTE_") ||
    PTB_SUPABASE_PUBLISHABLE_KEY.startsWith("PASTE_")
  ) {
    return Promise.reject(
      new Error("Supabase is not configured. Add your project URL and publishable key in js/supabase.js.")
    );
  }

  ptbSupabasePromise = loadPTBSupabaseSdk()
    .then(() => {
      window.ptbSupabase = window.supabase.createClient(
        PTB_SUPABASE_URL,
        PTB_SUPABASE_PUBLISHABLE_KEY,
        {
          auth: {
            autoRefreshToken: true,
            detectSessionInUrl: true,
            persistSession: true
          }
        }
      );
      return window.ptbSupabase;
    })
    .catch(error => {
      ptbSupabasePromise = null;
      throw error;
    });

  return ptbSupabasePromise;
};
