const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: true,
        // Never returned by a query unless explicitly asked for with .select('+password').
        select: false,
    },
});

// Belt and braces: even if a query does select the hash, it is stripped on serialisation.
userSchema.set('toJSON', {
    transform(doc, ret) {
        delete ret.password;
        delete ret.__v;

        return ret;
    },
});

const userModel = mongoose.model('User', userSchema);

module.exports = userModel;
