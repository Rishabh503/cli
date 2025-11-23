"use client"
import React, { use } from 'react'
import Image from "next/image"
import { Button } from '../button' 
import { Card,CardContent } from '../card'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { GithubIcon, UserPen } from 'lucide-react'




const LoginForm = () => {

    const router=useRouter()
    const [loading, setLoading] = useState(false)

  return (
  <div className="flex flex-col gap-6 justify-center items-center">
    <div className="flex flex-col items-center justify-center space-y-4">
      <Image src={"/login.svg"} alt="Login" height={500} width={500} />
      <h1 className="text-6xl font-extrabold text-indigo-400">Welcome Back! to Orbital Cli</h1>
      <p className="text-base font-medium text-zinc-400">Login to your account for allowing device flow</p>
    </div>
    <CardContent>
  <div className="grid gap-6">
    <div className="flex flex-col gap-4">
      <Button
        variant={"outline"}
        className="w-full h-full"
        type="button"
        onClick={() =>
          authClient.signIn.social({
            provider: "github",
            callbackURL: "http://localhost:3000",
          })
        }
      >
        <GithubIcon height={16} width={16}
          className="size-4 dark:invert"
        />
        Continue With GitHub
      </Button>
    </div>
  </div>
</CardContent>
  </div>
)
}

export default LoginForm