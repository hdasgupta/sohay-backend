// File: middleware/errorHandler.js
export const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const errorResponse = {
        error: {
            message: err.message || 'Internal Server Error Encountered',
            status: statusCode,
            timestamp: new Date().toISOString()
        }
    };

    if (process.env.NODE_ENV !== 'production') {
        errorResponse.error.stack = err.stack;
    }

    res.status(statusCode).json(errorResponse);
};
