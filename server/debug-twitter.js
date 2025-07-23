import { config } from "dotenv"
import { TwitterApi } from "twitter-api-v2"

config()

console.log('🔧 DEBUGGING TWITTER API SETUP');
console.log('================================');

// Check environment variables
console.log('\n📋 Environment Variables:');
console.log('TWITTER_API_KEY:', process.env.TWITTER_API_KEY ? `✅ Set (${process.env.TWITTER_API_KEY.length} chars)` : '❌ Not set');
console.log('TWITTER_API_SECRET:', process.env.TWITTER_API_SECRET ? `✅ Set (${process.env.TWITTER_API_SECRET.length} chars)` : '❌ Not set');
console.log('TWITTER_ACCESS_TOKEN:', process.env.TWITTER_ACCESS_TOKEN ? `✅ Set (${process.env.TWITTER_ACCESS_TOKEN.length} chars)` : '❌ Not set');
console.log('TWITTER_ACCESS_TOKEN_SECRET:', process.env.TWITTER_ACCESS_TOKEN_SECRET ? `✅ Set (${process.env.TWITTER_ACCESS_TOKEN_SECRET.length} chars)` : '❌ Not set');

// Show first/last few characters for verification
if (process.env.TWITTER_API_KEY) {
    console.log(`API Key preview: ${process.env.TWITTER_API_KEY.substring(0, 8)}...${process.env.TWITTER_API_KEY.slice(-4)}`);
}
if (process.env.TWITTER_ACCESS_TOKEN) {
    console.log(`Access Token preview: ${process.env.TWITTER_ACCESS_TOKEN.substring(0, 8)}...${process.env.TWITTER_ACCESS_TOKEN.slice(-4)}`);
}

console.log('\n🔗 Testing Twitter API Connection...');

// Test different authentication methods
async function testConnection() {
    try {
        // Method 1: Basic client setup
        console.log('\n📝 Method 1: Basic Client Setup');
        const client1 = new TwitterApi({
            appKey: process.env.TWITTER_API_KEY,
            appSecret: process.env.TWITTER_API_SECRET,
            accessToken: process.env.TWITTER_ACCESS_TOKEN,
            accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
        });

        console.log('✅ Client created successfully');

        // Method 2: Test read-only access
        console.log('\n📖 Method 2: Testing Read Access');
        try {
            const me = await client1.readOnly.currentUser();
            console.log(`✅ Read access works: @${me.screen_name}`);
            console.log(`   Name: ${me.name}`);
            console.log(`   Followers: ${me.followers_count}`);
            console.log(`   Account created: ${me.created_at}`);
        } catch (readError) {
            console.log('❌ Read access failed:', readError.message);
            if (readError.data) {
                console.log('   Error details:', readError.data);
            }
        }

        // Method 3: Test write access
        console.log('\n✍️ Method 3: Testing Write Access');
        try {
            const writeClient = client1.readWrite;
            const me = await writeClient.currentUser();
            console.log(`✅ Write client created: @${me.screen_name}`);
            
            // Check permissions by looking at available endpoints
            console.log('🔍 Checking write permissions...');
            // We won't actually post, just check if the method exists
            console.log('✅ Tweet method available:', typeof writeClient.v2.tweet === 'function');
            
        } catch (writeError) {
            console.log('❌ Write access failed:', writeError.message);
            if (writeError.data) {
                console.log('   Error details:', writeError.data);
            }
        }

        // Method 4: Test with Bearer Token (if available)
        console.log('\n🔑 Method 4: Testing Bearer Token Access');
        if (process.env.TWITTER_BEARER_TOKEN) {
            try {
                const bearerClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);
                const appInfo = await bearerClient.v2.me();
                console.log('✅ Bearer token works:', appInfo.data);
            } catch (bearerError) {
                console.log('❌ Bearer token failed:', bearerError.message);
            }
        } else {
            console.log('⚠️ No bearer token set (not required for basic posting)');
        }

    } catch (error) {
        console.log('❌ Connection test failed:', error.message);
        console.log('   Error type:', error.constructor.name);
        if (error.data) {
            console.log('   Error data:', error.data);
        }
    }
}

// Run the test
testConnection().then(() => {
    console.log('\n🏁 Debug test completed');
    console.log('================================');
}).catch((error) => {
    console.log('💥 Debug test crashed:', error.message);
});