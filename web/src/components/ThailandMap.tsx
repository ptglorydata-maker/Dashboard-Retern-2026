"use client";

import { useEffect, useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { scaleLinear } from "d3-scale";
import { COLORS } from "@/lib/types";

interface GeoFeature {
  type: "Feature";
  properties: { name: string };
  geometry: GeoJSON.Geometry;
}
interface GeoCollection {
  type: "FeatureCollection";
  features: GeoFeature[];
}

export interface ProvinceDatum {
  geo: string; // English name matching the GeoJSON's properties.name
  name: string; // Thai display name
  count: number;
  value: number;
}

export function ThailandMap({ data }: { data: ProvinceDatum[] }) {
  const [geoData, setGeoData] = useState<GeoCollection | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; d: ProvinceDatum | null; name: string } | null>(null);

  useEffect(() => {
    fetch("/data/thailand-provinces.geojson")
      .then((r) => r.json())
      .then(setGeoData)
      .catch(() => setGeoData(null));
  }, []);

  const byGeo = useMemo(() => {
    const map = new Map<string, ProvinceDatum>();
    for (const d of data) map.set(d.geo, d);
    return map;
  }, [data]);

  const maxCount = useMemo(() => Math.max(1, ...data.map((d) => d.count)), [data]);
  const colorScale = useMemo(
    () => scaleLinear<string>().domain([0, maxCount]).range(["#173047", COLORS.cyan]),
    [maxCount]
  );

  const width = 360;
  const height = 480;

  const { pathFor, features } = useMemo(() => {
    if (!geoData) return { pathFor: null, features: [] as GeoFeature[] };
    const projection = geoMercator().fitSize([width, height], geoData as unknown as GeoJSON.GeoJSON);
    const gen = geoPath(projection);
    return { pathFor: (f: GeoFeature) => gen(f as GeoJSON.Feature) ?? "", features: geoData.features };
  }, [geoData]);

  if (!geoData || !pathFor) {
    return <div className="flex items-center justify-center text-sm text-white/40" style={{ height }}>กำลังโหลดแผนที่...</div>;
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
        {features.map((f) => {
          const d = byGeo.get(f.properties.name);
          return (
            <path
              key={f.properties.name}
              d={pathFor(f)}
              fill={d ? colorScale(d.count) : "#1a2540"}
              stroke="#0a0f1e"
              strokeWidth={0.6}
              onMouseMove={(e) => {
                const rect = (e.target as SVGElement).ownerSVGElement!.getBoundingClientRect();
                setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, d: d ?? null, name: f.properties.name });
              }}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
      </svg>
      {hover && (
        <div
          className="absolute pointer-events-none bg-[#121a2e] border border-white/10 rounded-lg shadow-lg px-3 py-2 text-xs z-10 text-white/90"
          style={{ left: Math.min(hover.x + 10, width - 140), top: Math.max(hover.y - 10, 0) }}
        >
          <div className="font-semibold">{hover.d?.name ?? hover.name}</div>
          {hover.d ? (
            <>
              <div>ยอดตีกลับ: {hover.d.count.toLocaleString()}</div>
              <div>มูลค่า: ฿{hover.d.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </>
          ) : (
            <div className="text-white/40">ไม่มีข้อมูล</div>
          )}
        </div>
      )}
    </div>
  );
}
