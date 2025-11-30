import {google} from "@ai-sdk/google"
import {convertToModelMessages, streamText, tool} from "ai"

import { config } from "../../config/google.config.js"
import chalk from "chalk"



export class AIService{
    constructor(){
        if(!config.googleApiKey){
            throw new Error("google  api key not set in env")
        }

        this.model=google(config.model,{
            apiKey:config.googleApiKey
        })
    }

        /**
         * @param {Array} messages
         * @param {Function} onChunk
         * @param {Object} tools
         * @param {Function} onToolCall
         * @returns {Promise<Object>}
         */

        async sendMessage(messages,onChunk,tools=undefined,onToolCall=null){
            try {
                const streamConfig={
                    model:this.model,
                    messages:messages
                }


                if(tools && Object.keys(tools).length>0){
                    streamConfig.tools=tools;
                    streamConfig.maxSteps=5;
                    console.log(`DEBUG TOOLS ENABLED ${Object.keys(tools).join(", ")}`);
                }

                const result = streamText(streamConfig)

                let fullResponse=""
                for await (const chunk of result.textStream){
                    fullResponse+=chunk;
                    if(onChunk){
                        onChunk(chunk)
                    }

                }
                const fullResult=result

                const toolCalls=[]
                const toolResults=[]

                if(fullResult.steps && Array.isArray(fullResult.steps)){
                    for(const step of fullResult.steps){
                        if(step.toolCalls && step.toolCalls.length>0){
                            for(const toolCall of step.toolCalls){
                                toolCalls.push(toolCall);
                                if(onToolCall){
                                    onToolCall(toolCall)
                                }
                            }
                        }

                        if(step.toolResults && step.toolResults.length>0){
                            toolResults.push(...step.toolResults)
                        }
                    }
                }

                return {
                    content:fullResponse,
                    finishResponse:fullResult.finishReason,
                    usage:fullResult.usage,
                    toolCalls,
                    toolResults,
                    steps:fullResult.steps
                }
            } catch (error) {
                console.error(chalk.red("Ai service error"),error.message);
                throw error
            }
        }


         /**
         * @param {Array} messages
         * @param {Function} onChunk
         * @returns {Promise<Object>}
         */
        async getMessage(messages,tools=undefined){
            let fullResponse="";
           const result=  await this.sendMessage(messages,(chunk)=>{
                fullResponse+=chunk
            },tools)
            return result.content
        }

}