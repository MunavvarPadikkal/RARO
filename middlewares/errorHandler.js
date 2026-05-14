const errorHandler = (err, req, res, next) => {
    console.error("Error Catch:", err);

    const statusCode = err.status || 500;

    // Check if the request expects JSON
    const isJsonRequest = req.xhr || 
                         (req.headers.accept && req.headers.accept.includes('application/json')) ||
                         (req.headers['content-type'] && req.headers['content-type'].includes('application/json'));

    if (isJsonRequest) {
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Internal Server Error"
        });
    }

    // Direct web traffic to appropriate generic error pages
    if (req.originalUrl.startsWith('/admin')) {
        return res.redirect('/admin/pageError');
    }

    return res.redirect('/pageNotFound');
};

const notFoundHandler = (req, res, next) => {
    const error = new Error(`Route Not Found - ${req.originalUrl}`);
    error.status = 404;
    next(error);
};

module.exports = {
    errorHandler,
    notFoundHandler
};
