class ApiResponse {
    static success(res, data = null, message = 'Success', statusCode = 200) {
        return res.status(statusCode).json({
            success: true,
            message,
            data,
            timestamp: new Date().toISOString()
        });
    }
    
    static error(res, message = 'Error occurred', statusCode = 500, errors = null) {
        const response = {
            success: false,
            message,
            timestamp: new Date().toISOString()
        };
        
        if (errors) {
            response.errors = errors;
        }
        
        return res.status(statusCode).json(response);
    }
    
    static paginated(res, data, page, limit, total, message = 'Success') {
        const totalPages = Math.ceil(total / limit);
        
        return res.json({
            success: true,
            message,
            data,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            timestamp: new Date().toISOString()
        });
    }
    
    static created(res, data = null, message = 'Resource created successfully') {
        return this.success(res, data, message, 201);
    }
    
    static noContent(res, message = 'No content') {
        return res.status(204).json({
            success: true,
            message,
            timestamp: new Date().toISOString()
        });
    }
    
    static badRequest(res, message = 'Bad request', errors = null) {
        return this.error(res, message, 400, errors);
    }
    
    static unauthorized(res, message = 'Unauthorized') {
        return this.error(res, message, 401);
    }
    
    static forbidden(res, message = 'Forbidden') {
        return this.error(res, message, 403);
    }
    
    static notFound(res, message = 'Resource not found') {
        return this.error(res, message, 404);
    }
}

module.exports = ApiResponse;