const checkSession = (req,res,next)=>{
    if(req.session.user){
        next()
    }else{
        res.redirect('/signin')
    }
}

const isSignin = (req,res,next)=>{
    if(req.session.user){
        res.redirect('/')
    }else{
        next();
    }
}
module.exports = {checkSession, isSignin}