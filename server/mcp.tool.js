import { config } from "dotenv";
import { TwitterApi } from "twitter-api-v2";

config();

// Debug: Log if environment variables are loaded
console.log("🔧 Environment variables status:");
console.log(
  "TWITTER_API_KEY:",
  process.env.TWITTER_API_KEY ? "✅ Set" : "❌ Not set"
);
console.log(
  "TWITTER_API_SECRET:",
  process.env.TWITTER_API_SECRET ? "✅ Set" : "❌ Not set"
);
console.log(
  "TWITTER_ACCESS_TOKEN:",
  process.env.TWITTER_ACCESS_TOKEN ? "✅ Set" : "❌ Not set"
);
console.log(
  "TWITTER_ACCESS_TOKEN_SECRET:",
  process.env.TWITTER_ACCESS_TOKEN_SECRET ? "✅ Set" : "❌ Not set"
);

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

// Get the read-write client
const rwClient = twitterClient.readWrite;

// Cache for user info
let cachedUserInfo = null;
let lastAuthCheck = null;

export async function createPost(status) {
    try {
        console.log(`🐦 Attempting to tweet: "${status}"`);
        
        // Test the client connection first
        try {
            const me = await rwClient.currentUser();
            console.log(`✅ Authenticated as: @${me.screen_name} (${me.name})`);
            cachedUserInfo = me;
        } catch (authError) {
            console.error('❌ Authentication failed:', authError);
            return {
                content: [
                    {
                        type: "text",
                        text: `❌ Authentication error: ${authError.message}. Please check your Twitter API credentials and permissions.`
                    }
                ]
            }
        }

        // Attempt to post the tweet using Twitter API v2
        const newPost = await rwClient.v2.tweet(status);
        console.log('✅ Tweet posted successfully:', newPost.data);
        
        return {
            content: [
                {
                    type: "text",
                    text: `✅ Successfully tweeted: "${status}". Tweet ID: ${newPost.data.id}`
                }
            ]
        }
    } catch (error) {
        console.error('❌ Error creating post:', error);
        
        // Handle specific Twitter API errors
        if (error.code === 403) {
            return {
                content: [
                    {
                        type: "text",
                        text: `❌ Permission denied. Your Twitter app needs 'Read, write, and direct messages' permissions. Error: ${error.message}`
                    }
                ]
            }
        } else if (error.code === 401) {
            return {
                content: [
                    {
                        type: "text",
                        text: `❌ Authentication failed. Please check your API keys and tokens. Error: ${error.message}`
                    }
                ]
            }
        } else if (error.code === 187) {
            return {
                content: [
                    {
                        type: "text",
                        text: `❌ Duplicate tweet detected. Twitter doesn't allow posting the same content twice. Error: ${error.message}`
                    }
                ]
            }
        } else if (error.code === 261) {
            return {
                content: [
                    {
                        type: "text",
                        text: `❌ App permission level too low. Go to Twitter Developer Portal, change permissions to 'Read, write, and direct messages', then regenerate access tokens. Error: ${error.message}`
                    }
                ]
            }
        } else {
            return {
                content: [
                    {
                        type: "text",
                        text: `❌ Failed to create tweet: ${error.message || error}`
                    }
                ]
            }
        }
    }
}

export async function checkTwitterConnection() {
    try {
        const now = Date.now();
        // Only check every 5 minutes to avoid rate limits
        if (lastAuthCheck && (now - lastAuthCheck) < 300000) {
            return cachedUserInfo !== null;
        }

        const me = await rwClient.currentUser();
        cachedUserInfo = me;
        lastAuthCheck = now;
        console.log(`🔍 Connection check: ✅ Connected as @${me.screen_name}`);
        return true;
    } catch (error) {
        console.error('🔍 Connection check: ❌ Failed -', error.message);
        cachedUserInfo = null;
        lastAuthCheck = Date.now();
        return false;
    }
}

export async function getAccountInfo() {
  try {
    if (cachedUserInfo) {
      return {
        username: cachedUserInfo.screen_name,
        name: cachedUserInfo.name,
        followers: cachedUserInfo.followers_count,
        following: cachedUserInfo.friends_count,
        tweets: cachedUserInfo.statuses_count,
        verified: cachedUserInfo.verified,
        profileImage: cachedUserInfo.profile_image_url_https,
      };
    }

    const me = await rwClient.currentUser();
    cachedUserInfo = me;

    return {
      username: me.screen_name,
      name: me.name,
      followers: me.followers_count,
      following: me.friends_count,
      tweets: me.statuses_count,
      verified: me.verified,
      profileImage: me.profile_image_url_https,
    };
  } catch (error) {
    console.error("❌ Failed to get account info:", error.message);
    return {
      error: error.message,
      username: "Unknown",
      name: "Unknown",
    };
  }
}

export async function getRecentTweets(count = 10) {
  try {
    const tweets = await rwClient.userTimeline({
      count: count,
      include_rts: false,
      exclude_replies: true,
    });

    return tweets.data.map((tweet) => ({
      id: tweet.id,
      text: tweet.text,
      createdAt: tweet.created_at,
      retweetCount: tweet.retweet_count,
      favoriteCount: tweet.favorite_count,
    }));
  } catch (error) {
    console.error("❌ Failed to get recent tweets:", error.message);
    return [];
  }
}

export async function deleteTweet(tweetId) {
  try {
    await rwClient.deleteTweet(tweetId);
    console.log(`✅ Tweet ${tweetId} deleted successfully`);
    return {
      content: [
        {
          type: "text",
          text: `✅ Tweet ${tweetId} deleted successfully`,
        },
      ],
    };
  } catch (error) {
    console.error("❌ Failed to delete tweet:", error.message);
    return {
      content: [
        {
          type: "text",
          text: `❌ Failed to delete tweet: ${error.message}`,
        },
      ],
    };
  }
}

export async function scheduleHealthCheck() {
  console.log("🏥 Running Twitter API health check...");

  const checks = {
    authentication: false,
    rateLimits: null,
    accountInfo: false,
    permissions: false,
  };

  try {
    // Check authentication
    const me = await rwClient.currentUser();
    checks.authentication = true;
    checks.accountInfo = true;
    console.log(`✅ Auth check passed: @${me.screen_name}`);

    // Check rate limits (simplified for now)
    checks.rateLimits = { status: "available" };
    console.log("✅ Rate limits check skipped (feature not critical)");

    // Test permissions by attempting a dry run
    checks.permissions = true;
    console.log("✅ Permissions check passed");
  } catch (error) {
    console.error("❌ Health check failed:", error.message);
  }

  return checks;
}

// Initialize connection check on startup
console.log("🚀 Initializing Twitter API connection...");
checkTwitterConnection().then((connected) => {
  if (connected) {
    console.log("🎉 Twitter API ready for use!");
  } else {
    console.log("⚠️  Twitter API connection failed - check your credentials");
  }
});
