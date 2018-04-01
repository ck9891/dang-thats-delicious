
const passport = require('passport');
const crypto = require('crypto');
const mongoose = require('mongoose');
const promisify = require('es6-promisify');
const User = mongoose.model('User');
const mail = require('../handlers/mail');


exports.login = passport.authenticate('local', {
    failureRedirect: '/login',
    failureFlash: 'Failed Login!',
    successRedirect: '/',
    successFlash: 'You are now logged in!'
  });


exports.logout = (req, res) => {
    req.logout();
    req.flash('success', 'You are now logged out!');
    res.redirect('/');
};

exports.isLoggedIn = (req, res, next) => {
    // first check if user is logged in
    if(req.isAuthenticated()) {
        next(); // carry on, user is logged in
        return;
    } 
    req.flash('error', "Oops you must be logged in to do that!");
    res.redirect('/login');
};

exports.forgot = async (req, res) => {
    // See if user exists
    const user = await User.findOne({ email: req.body.email });
    // Set reset tokens and expiry on account
    if(!user) {
        req.flash('error', 'No account with that email exists!');
        return res.redirect('/login')
    }
    user.resetPasswordToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordExpires = Date.now() + 360000; //1 hr from now
    await user.save();
    // Send them an email with the token
    const resetURL = `http://${req.headers.host}/account/reset/${user.resetPasswordToken}`; 
    await mail.send({
        user,
        subject: 'Password Reset',
        resetURL,
        filename: 'password-reset'
    });
    req.flash('success', 'You have been emailed a password reset link.');
    // Redirect to login page
    res.redirect('/login');
};

exports.reset = async (req, res) => {
    const user = await User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: { $gt: Date.now() }
    });
    if(!user) {
        req.flash('error', 'Password reset token is invalid.');
        return res.redirect('/login');
    }
    //show the reset password form
    res.render('reset', {title: 'Reset your Password'});
};

exports.confirmedPasswords = (req, res, next) => {
    if(req.body.password === req.body['confirm-password']) {
        next(); // keep it going
        return;
    }
    req.flash('error', 'Passwords do not match!');
    res.redirect('back');
}

exports.update = async (req, res) => {
    const user = await User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: { $gt: Date.now() }
    });
    if(!user) {
        req.flash('error', 'Password reset token is invalid.');
        return res.redirect('/login');
    }

    const setPassword = promisify(user.setPassword, user);
    await setPassword(req.body.password);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    const updatedUser = await user.save();
    await req.login(updatedUser);

    req.flash('success', 'Nice! Your password has been reset! You are now logged in!');
    res.redirect('/');
};