import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createPost, checkTwitterConnection, getAccountInfo } from "./mcp.tool.js";
import { z } from "zod";
import path from "path";
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = new McpServer({
    name: "tweetmind-server",
    version: "2.0.0"
});

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // For serving static files

// Store for analytics and logs
let analytics = {
    totalTweets: 0,
    successfulTweets: 0,
    failedTweets: 0,
    aiAssists: 0,
    recentTweets: [],
    logs: []
};

// Helper function to add log
function addLog(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, message, type };
    analytics.logs.unshift(logEntry);
    
    // Keep only last 100 logs
    if (analytics.logs.length > 100) {
        analytics.logs = analytics.logs.slice(0, 100);
    }
    
    console.log(`[${timestamp}] ${type.toUpperCase()}: ${message}`);
}

// Helper function to add recent tweet
function addRecentTweet(text, status, tweetId = null) {
    const tweet = {
        id: tweetId,
        text,
        status,
        timestamp: new Date().toISOString()
    };
    
    analytics.recentTweets.unshift(tweet);
    
    // Keep only last 20 tweets
    if (analytics.recentTweets.length > 20) {
        analytics.recentTweets = analytics.recentTweets.slice(0, 20);
    }
}

// MCP Server Tools
server.tool(
    "addTwoNumbers",
    "Add two numbers",
    {
        a: z.number(),
        b: z.number()
    },
    async (arg) => {
        const { a, b } = arg;
        return {
            content: [
                {
                    type: "text",
                    text: `The sum of ${a} and ${b} is ${a + b}`
                }
            ]
        }
    }
);

server.tool(
    "createPost",
    "Create a post on X (formerly Twitter)",
    {
        status: z.string()
    },
    async (arg) => {
        const { status } = arg;
        analytics.totalTweets++;
        
        addLog(`Attempting to post tweet: "${status.substring(0, 50)}${status.length > 50 ? '...' : ''}"`);
        
        try {
            const result = await createPost(status);
            
            // Check if the post was successful
            if (result.content[0].text.includes('Successfully tweeted')) {
                analytics.successfulTweets++;
                addRecentTweet(status, 'Posted', 'tweet_id_placeholder');
                addLog('Tweet posted successfully', 'success');
            } else {
                analytics.failedTweets++;
                addRecentTweet(status, 'Failed');
                addLog(`Tweet failed: ${result.content[0].text}`, 'error');
            }
            
            return result;
        } catch (error) {
            analytics.failedTweets++;
            addRecentTweet(status, 'Failed');
            addLog(`Tweet error: ${error.message}`, 'error');
            throw error;
        }
    }
);

server.tool(
    "getAnalytics",
    "Get analytics and system status",
    {},
    async () => {
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(analytics, null, 2)
                }
            ]
        }
    }
);

// Web API Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// API endpoint to post tweets
app.post('/api/tweet', async (req, res) => {
    try {
        const { status } = req.body;
        
        if (!status || status.trim().length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Tweet content is required' 
            });
        }

        if (status.length > 280) {
            return res.status(400).json({ 
                success: false, 
                error: 'Tweet exceeds 280 character limit' 
            });
        }

        analytics.totalTweets++;
        addLog(`Web API: Attempting to post tweet: "${status.substring(0, 50)}${status.length > 50 ? '...' : ''}"`);
        
        const result = await createPost(status);
        
        // Check if the post was successful
        if (result.content[0].text.includes('Successfully tweeted')) {
            analytics.successfulTweets++;
            addRecentTweet(status, 'Posted', 'tweet_id_placeholder');
            addLog('Web API: Tweet posted successfully', 'success');
            
            res.json({ 
                success: true, 
                message: 'Tweet posted successfully!',
                tweetId: 'tweet_id_placeholder'
            });
        } else {
            analytics.failedTweets++;
            addRecentTweet(status, 'Failed');
            addLog(`Web API: Tweet failed: ${result.content[0].text}`, 'error');
            
            res.status(400).json({ 
                success: false, 
                error: result.content[0].text 
            });
        }
        
    } catch (error) {
        analytics.failedTweets++;
        addLog(`Web API: Tweet error: ${error.message}`, 'error');
        
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Internal server error' 
        });
    }
});

// API endpoint to get analytics
app.get('/api/analytics', (req, res) => {
    res.json({
        success: true,
        data: {
            ...analytics,
            successRate: analytics.totalTweets > 0 ? 
                Math.round((analytics.successfulTweets / analytics.totalTweets) * 100) : 100
        }
    });
});

// API endpoint to get system status
app.get('/api/status', async (req, res) => {
    try {
        const twitterStatus = await checkTwitterConnection();
        const accountInfo = await getAccountInfo();
        
        res.json({
            success: true,
            data: {
                server: 'Connected',
                twitter: twitterStatus ? 'Authenticated' : 'Disconnected',
                ai: 'Ready',
                account: accountInfo,
                uptime: process.uptime()
            }
        });
    } catch (error) {
        res.json({
            success: true,
            data: {
                server: 'Connected',
                twitter: 'Error',
                ai: 'Ready',
                error: error.message,
                uptime: process.uptime()
            }
        });
    }
});

// API endpoint for AI suggestions
app.post('/api/ai-suggest', (req, res) => {
    analytics.aiAssists++;
    
    const suggestions = [
        "🚀 Just launched something amazing! The future of AI is here and it's more exciting than ever. What innovations are you most excited about? #AI #Innovation",
        "💡 Pro tip: The best ideas often come from the simplest observations. Take a moment today to notice something small but significant around you. #Mindfulness #Ideas",
        "🌟 Behind every successful project is a story of persistence, creativity, and countless cups of coffee. What's fueling your current project? #Motivation #Success",
        "🤖 AI isn't about replacing human creativity—it's about amplifying it. Together, we can build something extraordinary. #AIxHuman #Collaboration",
        "📈 Growth isn't just about numbers—it's about the impact we create, the problems we solve, and the communities we build. What impact are you creating today? #Growth #Impact",
        "🔥 The most successful people aren't those who never fail, but those who learn from every setback and keep moving forward. What lesson changed your perspective recently?",
        "⚡ Small daily improvements compound into extraordinary results. What's one tiny habit you're building that will transform your future? #GrowthMindset #Habits",
        "🎯 Focus isn't about doing more things—it's about doing the right things exceptionally well. What deserves your focus today? #Focus #Productivity",
        "🌍 Technology connects us globally, but genuine relationships still happen one conversation at a time. Who will you reach out to today? #Connection #Community"
    ];
    
    const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
    
    addLog('AI suggestion generated via web API', 'info');
    
    res.json({
        success: true,
        suggestion: randomSuggestion
    });
});

// API endpoint to clear logs
app.delete('/api/logs', (req, res) => {
    analytics.logs = [];
    addLog('Logs cleared via web API', 'info');
    
    res.json({
        success: true,
        message: 'Logs cleared successfully'
    });
});

// MCP Server SSE endpoints
const transports = {};

app.get("/sse", async (req, res) => {
    const transport = new SSEServerTransport('/messages', res);
    transports[transport.sessionId] = transport;
    
    res.on("close", () => {
        delete transports[transport.sessionId];
    });
    
    await server.connect(transport);
    addLog(`MCP client connected: ${transport.sessionId}`, 'info');
});

app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId;
    const transport = transports[sessionId];
    
    if (transport) {
        await transport.handlePostMessage(req, res);
    } else {
        res.status(400).send('No transport found for sessionId');
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '2.0.0'
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    addLog(`Server error: ${error.message}`, 'error');
    
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not found',
        message: `Route ${req.method} ${req.path} not found`
    });
});

// Start server
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`
🚀 TweetMind AI Agent Server Started!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Web Dashboard: http://localhost:${PORT}
🔗 MCP Endpoint:  http://localhost:${PORT}/sse
💡 API Docs:      http://localhost:${PORT}/health
⚡ Status:        Server running on port ${PORT}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ready to tweet with AI assistance! 🤖✨
    `);
    
    addLog('TweetMind server started successfully', 'success');
    addLog(`Web dashboard available at http://localhost:${PORT}`, 'info');
    addLog(`MCP endpoint ready at http://localhost:${PORT}/sse`, 'info');
});