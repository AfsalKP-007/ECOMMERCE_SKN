

module.exports = (err, req, res, next) => {

    console.error("🔥 Error Handler:", 'From My new ErrorHandler', err.stack || err.message);

    res.status(err.status || 500).render('error', {
        message: err.message || "Something went wrong!",
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
};

