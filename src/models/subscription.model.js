import mongoose from "mongoose";
const subscriptionSchema = new mongoose.Schema({
    subscriber:{
        type: mongoose.Schema.Types.ObjectId,    // one who is subcribing:-
        ref: "User"
    },
    channel:{
        type: mongoose.Schema.Types.ObjectId,    // one to whom is subscriber is subscribing:-
        ref: "User"
    }

},{timestamps:true});

export const Subscription = mongoose.model("Subscription", subscriptionSchema); 