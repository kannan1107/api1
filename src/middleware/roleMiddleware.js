


function authorizeRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role?.toLowerCase())) {
      return res.status(403).json({
        status: "error",
        message: "unauthorized",
      });
    }
    next();
  };
}



 


export default authorizeRole;