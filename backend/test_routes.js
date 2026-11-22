const assert = require('assert');
const aiRoutes = require('./routes/aiRoutes');

function runTests() {
    console.log('Running backend route tests...');

    // 1. Verify router is instantiated
    assert(aiRoutes && typeof aiRoutes === 'function', 'aiRoutes should be a valid Express router');

    // 2. Verify protected route rejects unauthorized requests
    const mockReq = { headers: {} };
    let statusSet = null;
    let jsonSent = null;

    const mockRes = {
        status: (code) => {
            statusSet = code;
            return {
                json: (data) => {
                    jsonSent = data;
                }
            };
        }
    };

    const { protect } = require('./middleware/authMiddleware');
    protect(mockReq, mockRes, () => {});

    assert.strictEqual(statusSet, 401, 'Unauthorized request must return HTTP 401');
    assert(jsonSent && jsonSent.message.includes('Not authorized'), 'Response should state unauthorized');

    console.log('ALL BACKEND ROUTE TESTS PASSED!');
}

runTests();

