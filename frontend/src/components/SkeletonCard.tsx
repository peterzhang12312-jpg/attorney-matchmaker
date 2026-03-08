export default function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-[rgba(25,25,24,0.12)] p-6 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-9 bg-[rgba(25,25,24,0.07)] rounded-full" />
        <div className="flex-1">
          <div className="h-4 bg-[rgba(25,25,24,0.07)] rounded w-2/5 mb-1.5" />
          <div className="h-3 bg-[rgba(25,25,24,0.07)] rounded w-1/3" />
        </div>
        <div className="h-8 w-16 bg-[rgba(25,25,24,0.07)] rounded-full" />
      </div>
      <div className="h-3 bg-[rgba(25,25,24,0.07)] rounded w-full mb-2" />
      <div className="h-3 bg-[rgba(25,25,24,0.07)] rounded w-5/6 mb-2" />
      <div className="h-3 bg-[rgba(25,25,24,0.07)] rounded w-4/6 mb-4" />
      <div className="flex gap-2">
        <div className="h-5 w-16 bg-[rgba(25,25,24,0.07)] rounded-full" />
        <div className="h-5 w-20 bg-[rgba(25,25,24,0.07)] rounded-full" />
        <div className="h-5 w-14 bg-[rgba(25,25,24,0.07)] rounded-full" />
      </div>
    </div>
  );
}
