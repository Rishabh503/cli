import {google} from "@ai-sdk/google"
import {convertToModelMessages, streamText} from "ai"

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

                const result = streamText(streamConfig)

                let fullResponse=""
                for await (const chunk of result.textStream){
                    fullResponse+=chunk;
                    if(onChunk){
                        onChunk(chunk)
                    }

                }
                const fullResult=result

                return {
                    content:fullResponse,
                    finishResponse:fullResult.finishReason,
                    usage:fullResult.usage
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
            await this.sendMessage(messages,(chunk)=>{
                fullResponse+=chunk
            })
            return fullResponse
        }

}