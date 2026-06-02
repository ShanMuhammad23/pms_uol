'use client'
import { redirect } from 'next/navigation'
import { useSession } from 'next-auth/react'
const page = async () => {  
  const { data: session } = useSession()
  if (!session) {
    redirect('/')
  }
  return (
    <div className='text-text-primary'>
      <h1 className='text-2xl font-bold'>Welcome, {session?.user?.name}</h1>
    </div>
  )
}

export default page