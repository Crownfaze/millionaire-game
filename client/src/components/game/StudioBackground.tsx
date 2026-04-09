import { useMemo } from 'react';

const BOKEH_COUNT = 12;

export default function StudioBackground() {
  const bokehDots = useMemo(() => {
    const dots = [];
    for (let i = 0; i < BOKEH_COUNT; i++) {
      const size = 2 + Math.random() * 4;
      dots.push({
        id: i,
        style: {
          width: size,
          height: size,
          left: `${5 + Math.random() * 90}%`,
          top: `${5 + Math.random() * 90}%`,
          animationDelay: `${Math.random() * 8}s`,
          animationDuration: `${6 + Math.random() * 6}s`,
          opacity: 0.1 + Math.random() * 0.3,
        },
      });
    }
    return dots;
  }, []);

  return (
    <div className="studio-bg">
      <div className="spotlight spotlight-1" />
      <div className="spotlight spotlight-2" />
      <div className="spotlight spotlight-3" />
      <div className="spotlight spotlight-4" />
      <div className="bokeh-container">
        {bokehDots.map((dot) => (
          <div key={dot.id} className="bokeh" style={dot.style} />
        ))}
      </div>
    </div>
  );
}
