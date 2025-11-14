


function authorizeRole (...roles) {

   return (req, res, next) => {

        if (!roles.includes(req.user.role)) {
           return res.status(403).json({
                status: "error",
                message: " unauthorized"
            });
           
        }
        next();
    };
    
}



 


export default authorizeRole;