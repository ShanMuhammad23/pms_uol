'use client'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { LayoutDashboard, LogOut} from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
const Sidebar = () => {
  const pathname = usePathname()
  const { data: session } = useSession()
  const user = session?.user
  const isDashboard = pathname === '/dashboard'
  const isProfile = pathname === '/dashboard/profile'
  return (
    <aside
    className="bg-surface border  border-r border-slate-300/80 dark:border-white/15 w-full h-full flex flex-col fixed top-0 left-0 max-w-[264px] py-6 overflow-auto transition-colors">
 
    <div className="flex flex-wrap items-center gap-4 relative px-4">
       <div className="flex flex-wrap items-center gap-2 flex-1">
          <Image src="/logo.png" width={100} height={100} alt="University of Lahore" className='invert dark:invert-0'/>
        
       </div>
       <div className="flex items-center gap-2">
          <ThemeToggle />
       </div>
    </div>
 
    <hr className="my-6 border-slate-300/80 dark:border-white/15" />
 
    <nav aria-label="Primary sidebar navigation" className="flex-1">
       <ul className="space-y-0.5 text-sm text-foreground/75 font-medium">
          <li>
             <Link href="/dashboard" aria-current={isDashboard ? 'page' : undefined}
                className={`flex items-center gap-2.5 text-text-primary px-6 py-3 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isDashboard ? 'bg-primary/10 border-r-4 border-primary' : 'hover:bg-primary/10 hover:border-r-4 border-primary'
                }`}>
                <LayoutDashboard className="size-4" />
                Dashboard
             </Link>
          </li>
         
         
          
         
          <li>
             <Link href="/dashboard/profile" aria-current={isProfile ? 'page' : undefined}
                className={`flex items-center gap-2.5 text-text-primary px-6 py-3 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isProfile ? 'bg-primary/10 border-r-4 border-primary' : 'hover:bg-primary/10 hover:border-r-4 border-primary'
                }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="size-[18px] fill-current overflow-visible"
                   viewBox="0 0 512 512" aria-hidden="true">
                   <path
                      d="M253.414 103.434c48.556 0 87.919 40.52 87.919 90.505s-39.363 90.505-87.919 90.505-87.919-40.521-87.919-90.505 39.363-90.505 87.919-90.505m0 36.202c-28.324 0-51.717 24.081-51.717 54.303s23.393 54.303 51.717 54.303 51.717-24.081 51.717-54.303-23.393-54.303-51.717-54.303"
                      data-original="#000000" />
                   <path
                      d="M253.414 0c139.957 0 253.414 113.457 253.414 253.414 0 94.285-51.491 176.544-127.886 220.19-35.728 20.575-77.036 32.582-121.104 33.199l-4.423.025C113.457 506.828 0 393.371 0 253.414S113.457 0 253.414 0m-23.676 346.505c-46.331 0-87.479 29.378-102.607 73.008l-2.339 7.571c35.919 27.232 80.165 42.893 126.504 43.522l5.709-.009c38.24-.62 74.079-11.122 105.072-29.064l19.977-13.243-2.237-6.866c-14.371-44.046-55.062-74.052-101.239-74.901zm23.676-310.303c-119.963 0-217.212 97.249-217.212 217.212 0 57.493 22.337 109.77 58.807 148.624 21.668-55.072 74.965-91.735 134.73-91.735h46.831c59.905 0 113.311 36.835 134.885 92.121 36.686-38.892 59.172-91.325 59.172-149.01-.001-119.963-97.25-217.212-217.213-217.212"
                      data-original="#000000" />
                </svg>
                Profile
             </Link>
          </li>
          <li>
             <a href="#"
                className="flex items-center gap-2.5 text-text-primary hover:text-text-primary hover:bg-primary/10 hover:border-r-4 border-primary px-6 py-3 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <svg xmlns="http://www.w3.org/2000/svg" className="size-[18px] fill-current overflow-visible"
                   viewBox="0 0 32 32" aria-hidden="true">
                   <g data-name="Layer 2">
                      <path
                         d="M24.915 3.663a3.15 3.15 0 0 0-2.688-1.554H9.774a3.15 3.15 0 0 0-2.688 1.554L.859 14.446a3.15 3.15 0 0 0 0 3.15l6.227 10.742a3.15 3.15 0 0 0 2.688 1.554h12.453a3.15 3.15 0 0 0 2.688-1.554l6.226-10.784a3.15 3.15 0 0 0 0-3.15zm4.41 12.841-6.227 10.784a1.05 1.05 0 0 1-.871.504H9.774a1.05 1.05 0 0 1-.872-.504L2.676 16.504a1.05 1.05 0 0 1 0-1.05L8.902 4.713a1.05 1.05 0 0 1 .872-.504h12.453a1.05 1.05 0 0 1 .871.504l6.227 10.783a1.05 1.05 0 0 1 0 1.008"
                         data-original="#000000" />
                      <path
                         d="M16 9.7a6.3 6.3 0 1 0 6.3 6.3A6.3 6.3 0 0 0 16 9.7m0 10.5a4.2 4.2 0 1 1 4.2-4.2 4.2 4.2 0 0 1-4.2 4.2"
                         data-original="#000000" />
                   </g>
                </svg>
                Settings
             </a>
          </li>
       </ul>
    </nav>
 
    <a href="#" onClick={() => signOut()}
       className="flex flex-wrap items-center gap-4 cursor-pointer mt-6 px-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 border-t border-slate-300/80 dark:border-white/15 pt-4">
       <div>
          <p className="text-sm text-text-primary font-medium">{user?.name}</p>
          <p className="text-xs text-foreground/70 mt-0.5">{user?.email}</p>
       </div>
       <LogOut className='size-4 text-red-500' />

    </a>
 </aside>
  )
}

export default Sidebar