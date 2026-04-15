"use client";

export default function Loading() {
    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-[#050505] flex items-center justify-center relative overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
            
            <div className="flex flex-col items-center gap-8 relative z-10">
                <div className="relative">
                    {/* Concentric Spinners */}
                    <div className="w-24 h-24 border-4 border-blue-600/10 rounded-full"></div>
                    <div className="w-24 h-24 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                    <div className="w-16 h-16 border-4 border-indigo-600/10 rounded-full absolute top-4 left-4"></div>
                    <div className="w-16 h-16 border-4 border-indigo-600 border-b-transparent rounded-full animate-[spin_1.5s_linear_infinite_reverse] absolute top-4 left-4"></div>
                    
                    {/* Inner Core */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse shadow-[0_0_15px_rgba(37,99,235,0.8)]"></div>
                    </div>
                </div>

                <div className="text-center space-y-3">
                    <h2 className="text-zinc-900 dark:text-white font-black uppercase text-xs tracking-[0.5em] animate-in fade-in slide-in-from-bottom-2 duration-700">
                        Terminal <span className="text-blue-600">Sync</span>
                    </h2>
                    <div className="flex flex-col items-center gap-1">
                        <p className="text-zinc-500 font-bold uppercase text-[8px] tracking-[0.2em] animate-pulse">
                            Establishing Encrypted Data Stream
                        </p>
                        <div className="w-32 h-1 bg-zinc-200 dark:bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 w-1/2 animate-[loading_2s_infinite_ease-in-out]"></div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes loading {
                    0% { transform: translateX(-150%); }
                    100% { transform: translateX(150%); }
                }
            `}</style>
        </div>
    );
}
