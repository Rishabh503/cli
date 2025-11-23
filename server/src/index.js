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
app.use("/api/auth", toNodeHandler(auth));

app.use(express.json())

app.get("/health",(req,res)=>{
    res.send("ok")
})


app.listen(process.env.PORT,()=>{
    console.log("server has been started",process.env.PORT)
})