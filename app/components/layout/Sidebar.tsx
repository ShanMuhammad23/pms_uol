'use client'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { FileText, Grid3X3, LayoutDashboard, LogOut,SquareUserRound,UserRound,List, Users} from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
const Sidebar = () => {
  const pathname = usePathname()
  const { data: session } = useSession()
  const user = session?.user
  const isDashboard = pathname === '/dashboard'
  const isProfile = pathname === '/dashboard/profile'
  const isForms = pathname.startsWith('/dashboard/forms')
  const isUsers = pathname.startsWith('/dashboard/users')
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const isEntityCategories = pathname === '/dashboard/entity-categories'
  const isMatricesAndCycles = pathname.startsWith('/dashboard/matrices-and-cycles')
  return (
    <aside
    className="bg-surface border  border-r border-slate-300/80 dark:border-white/15 w-full h-full flex flex-col fixed top-0 left-0 max-w-[264px] py-6 overflow-auto transition-colors">
 
    <div className="flex  items-center gap-4 relative px-4">
       <div className="flex flex-wrap items-center gap-2 flex-1">
          <Image src="/logo.png" width={100} height={100} alt="University of Lahore" className='invert dark:invert-0 '/>
        
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
                className={`sidebar-nav-link ${
                  isDashboard ? 'bg-primary/10 border-r-4 border-primary' : 'hover:bg-primary/10 hover:border-r-4 border-primary'
                }`}>
                <LayoutDashboard className="size-4" />
                Dashboard
             </Link>
          </li>
         
         
          
         
          {isSuperAdmin ? (
          <li>
             <Link href="/dashboard/forms" aria-current={isForms ? 'page' : undefined}
                className={`sidebar-nav-link ${
                  isForms ? 'bg-primary/10 border-r-4 border-primary' : 'hover:bg-primary/10 hover:border-r-4 border-primary'
                }`}>
                <FileText className="size-4" />
                Forms
             </Link>
          </li>
          ) : null}

          {isSuperAdmin ? (
          <li>
             <Link href="/dashboard/users" aria-current={isUsers ? 'page' : undefined}
                className={`sidebar-nav-link ${
                  isUsers ? 'bg-primary/10 border-r-4 border-primary' : 'hover:bg-primary/10 hover:border-r-4 border-primary'
                }`}>
                <Users className="size-4" />
                Users
             </Link>
          </li>
          ) : null}

          {isSuperAdmin ? (
          <li>
             <Link href="/dashboard/matrices-and-cycles" aria-current={isMatricesAndCycles ? 'page' : undefined}
                className={`sidebar-nav-link ${
                  isMatricesAndCycles ? 'bg-primary/10 border-r-4 border-primary' : 'hover:bg-primary/10 hover:border-r-4 border-primary'
                }`}>
                <Grid3X3 className="size-4" />
                Matrices and Cycles
             </Link>
          </li>
          ) : null}

          <li>
             <Link href="/dashboard/profile" aria-current={isProfile ? 'page' : undefined}
                className={`sidebar-nav-link ${
                  isProfile ? 'bg-primary/10 border-r-4 border-primary' : 'hover:bg-primary/10 hover:border-r-4 border-primary'
                }`}>
                <SquareUserRound className="size-4" />
                Profile
             </Link>
          </li>
          <li>
            <Link href="/dashboard/entity-categories" aria-current={isEntityCategories ? 'page' : undefined}
              className={`sidebar-nav-link ${
                isEntityCategories ? 'bg-primary/10 border-r-4 border-primary' : 'hover:bg-primary/10 hover:border-r-4 border-primary'
              }`}>
              <List className="size-4" />
              Entity & Categories
            </Link>
          </li>
       </ul>
    </nav>
 
    <a href="#" onClick={() => signOut()}
       className="flex  items-center justify-between cursor-pointer mt-6 px-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 border-t border-slate-300/80 dark:border-white/15 pt-4">
       <UserRound className='size-4' />
       <div>
          <p className="text-xs text-text-primary font-medium">{user?.name}</p>
          <p className="text-xs text-foreground/70 mt-0.5">{user?.email}</p>
       </div>
       <LogOut className='size-4 text-red-500' />

    </a>
 </aside>
  )
}

export default Sidebar