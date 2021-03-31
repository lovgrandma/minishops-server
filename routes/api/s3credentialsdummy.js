// This is what your s3credentials.js file should look like. Place in this same directory.
// Replace X's with appropriate credentials.

exports = module.exports = {
    app: {
        port: 5000
    },
    awsConfig: {
        accessKeyId: 'XXXXXXXXXXXXXXXXXXXX',
        secretAccessKey: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        region:'us-east-2',
        snsTopicArnId: 'arn:aws:sns:us-east-2:XXXXXXXXXXXX:XXXXXXXXXXXXXXXXX',
        roleArnId: 'arn:aws:iam::XXXXXXXXXXXX:user/XXXXXXXXXXXXXXXXXXXXX',
        sqsQueue: 'https://sqs.us-east-2.amazonaws.com/XXXXXXXXXXXX/XXXXXXXXXXXXXXXXX'
    },
    cloudFrontKeysPath: {
        public: "./routes/api/keys/rsa-XXXXXXXXXXXXXXXXXXXX.pem",
        private: "./routes/api/keys/pk-XXXXXXXXXXXXXXXXXXXX.pem"
    },
    cdn: {
        cloudFront1: "https://XXXXXXXXXXXXXX.cloudfront.net"
    },
    neo: {
        address: "bolt://localhost:7687",
        username: "neo4j",
        password: "XXXXXXXXXXXXXX"
    },
    mongo: { 
        address: 'mongodb://localhost:27017/minipost'
    },
    redis: {
        redishost: "localhost", // 127.0.0.1 was originally here but localhost should work on IPv6 only systems
        redisport: 6379,
        videoviewslikesport : 6380,
        articlereadslikesport: 6381,
        adviewsport: 6382,
        dailyadlimitsport: 6383,
        channelsubscriptionsport: 6384
    },
    stripe: {
        testkey: 'sk_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        key: 'sk_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
    }
};