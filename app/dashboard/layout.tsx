import React from 'react'
import Sidebar from '../components/layout/Sidebar'
const layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className='flex min-h-screen bg-background text-foreground transition-colors'>
        <Sidebar />
        <main className='ml-[264px] flex-1 min-h-screen bg-background text-foreground p-6 transition-colors'>
            {children}
        </main>
    </div>
  )
}

export default layout