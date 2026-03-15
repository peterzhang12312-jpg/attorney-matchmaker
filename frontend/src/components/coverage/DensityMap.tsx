import { ComposableMap, Geographies, Geography } from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

const FIPS_TO_ABBREV: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO",
  "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI",
  "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
  "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
  "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
  "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
  "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
  "54": "WV", "55": "WI", "56": "WY",
};

function stateColor(count: number): string {
  if (count >= 5) return "#4ade80";  // green-400
  if (count >= 1) return "#FCAA2D";  // amber
  return "#fca5a5";                   // red-300
}

export interface StateStats {
  count: number;
  coverage: string;
  primary_court_label: string;
}

interface Props {
  states: Record<string, StateStats>;
  onSelectState: (abbrev: string, stats: StateStats) => void;
  selectedState: string | null;
}

export default function DensityMap({ states, onSelectState, selectedState }: Props) {
  return (
    <ComposableMap projection="geoAlbersUsa" className="w-full max-w-3xl mx-auto">
      <Geographies geography={GEO_URL}>
        {({ geographies }) =>
          geographies.map((geo) => {
            const fips = geo.id as string;
            const abbrev = FIPS_TO_ABBREV[fips] || "";
            const stats = states[abbrev];
            const count = stats?.count ?? 0;
            const isSelected = selectedState === abbrev;

            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={isSelected ? "#191918" : stateColor(count)}
                stroke="#FFFEF2"
                strokeWidth={0.5}
                style={{
                  default: { outline: "none" },
                  hover: { outline: "none", opacity: 0.8 },
                  pressed: { outline: "none" },
                }}
                onClick={() => abbrev && stats && onSelectState(abbrev, stats)}
                className="cursor-pointer transition-opacity"
              />
            );
          })
        }
      </Geographies>
    </ComposableMap>
  );
}
