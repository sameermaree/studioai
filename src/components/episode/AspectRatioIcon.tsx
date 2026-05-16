export function AspectRatioIcon({ ratio }: { ratio: string }) {
  const dims: Record<string, { w: number; h: number }> = {
    '16:9': { w: 20, h: 12 },
    '9:16': { w: 12, h: 20 },
    '1:1': { w: 16, h: 16 },
  };

  const dimensions = dims[ratio] || dims['16:9'];

  return (
    <div className="flex justify-center">
      <div
        className="border border-current rounded-sm"
        style={{
          width: dimensions.w,
          height: dimensions.h,
        }}
      />
    </div>
  );
}
