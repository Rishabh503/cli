import dotenv from "dotenv";
import express from "express"
import cors from "cors"
// import { auth } from "./lib/auth";
// import {toNodeHandlder} from "better-auth/node"
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
dotenv.config()

const app=express();

app.use(cors(
   { origin:"http://localhost:3000",
    methods:["GET","POST","PUT","DELETE"],
    credentials:true
   }

))
// app.use("/api/auth", toNodeHandler(auth));

app.all('/api/auth/{*any}', toNodeHandler(auth));
app.use(express.json())


app.get("/health",(req,res)=>{
    res.send("ok")
})

app.get("/device",async(req,res)=>{
    const {user_code}=req.query
    res.redirect(`http://localhost:3000/device?user_code=${user_code}`)
})


app.listen(process.env.PORT,()=>{
    console.log("server has been started",process.env.PORT)
})