import { Map } from 'lucide-react';

export default function Header() {
    return (
        <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:bg-zinc-950/95 dark:border-zinc-800">
            <div className="container flex h-14 items-center">
                <div className="mr-4 hidden md:flex">
                    <a className="mr-6 flex items-center space-x-2" href="/">
                        <Map className="h-6 w-6" />
                        <span className="hidden font-bold sm:inline-block">
                            Inmobiliaria GIS
                        </span>
                    </a>
                </div>
            </div>
        </header>
    );
}
