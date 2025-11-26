import prisma from "../lib/db.js"

export class ChatService{
    /**
     * @param {String} userId
     * @param {String} mode
     * @param {String} title
     */

    async createConversation(userId,mode="chat",title=null){
        return prisma.conversation.create({
            data:{
                userId,
                mode,
                title:title || `New ${mode} conversation`
            }
        })
    }


     /**
     * @param {String} userId
     * @param {String} conversationId
     * @param {String} mode
     */

     async getOrCreate(userId,conversationId=null,mode="chat"){
        if(conversationId){
            const conversation=await prisma.conversation.findFirst({
                where:{
                    id:conversationId,
                    userId
                },
                include:{
                    messages:{
                        orderBy:{
                            createdAt:desc
                        }
                    }
                }
            })

            if(conversation) return conversation

        }

        return await this.createConversation(userId,mode)
    }


      /**
     * @param {String} conversationId
     * @param {String} role
     * @param {String} content
     */

      async addMessage(conversationId,role,content){
        const contentStr=typeof content==="string"?
        content:JSON.stringify(content);

        return await prisma.message.create({
            data:{
                conversationId,
                role,
                content:contentStr
            }
        })
      }

        /**
     * @param {String} conversationId
     */

    async getMessages(conversationId){
        const messages=await prisma.message.findMany({
            where:{conversationId},
            orderBy:{createdAt:"asc"}
        })


        return messages.map((msg)=>({
            ...msg,
            content:this.parseContent(msg.content)
        }))
    }

      /**
     * @param {String} userId
     */

      async getUserConversation(userId){
        return await prisma.conversation.findMany({
            where:{userId},
            orderBy:{updatedAt:"desc"},
            include:{
                messages:{
                    take:1,
                    orderBy:{createdAt:"desc"}
                }
            }
        }) 
      }

        /**
     * @param {String} conversationId
     * @param {String} userId
     */

        async deleteConversation(conversationId,userId){
            return await prisma.conversation.deleteMany({
                where:{
                    id:conversationId,
                    userId
                },

            })
        }


            /**
     * @param {String} conversationId
     * @param {String} title
     */

        async updateTitle(conversationId,title){
            return await prisma.conversation.update({
                where:{id:conversationId},
                data:{title}
            })
        }

        parseContent(content){
            try{
                return  JSON.parse(content)
            }catch{
                return content
            }
        }

        /**
         * @param {Array} messages
         */

        formatMessagesForAI(messages){
            return messages.map((msg)=>({
                role:msg.role,
                content:typeof msg.content==="string"? msg.content : JSON.stringify(msg.content)
            }))
        }
}