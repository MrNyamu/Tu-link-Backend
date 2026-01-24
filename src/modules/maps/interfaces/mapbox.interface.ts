export interface Coordinates {
  lng: number;
  lat: number;
}

export interface BoundingBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface GeocodingResult {
  id: string;
  text: string;
  placeName: string;
  coordinates: [number, number]; // [lng, lat]
  bbox?: [number, number, number, number];
  properties?: Record<string, any>;
  context?: Array<{
    id: string;
    text: string;
    wikidata?: string;
    short_code?: string;
  }>;
  relevance: number;
}

export interface GeocodingOptions {
  proximity?: [number, number]; // [lng, lat]
  bbox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  country?: string[];
  types?: string[];
  limit?: number;
  autocomplete?: boolean;
  language?: string[];
}

export interface Route {
  id: string;
  distance: number; // meters
  duration: number; // seconds
  geometry: GeoJSON.LineString;
  legs: RouteLeg[];
  waypoints: Waypoint[];
}

export interface RouteLeg {
  distance: number;
  duration: number;
  steps?: RouteStep[];
  summary?: string;
  weight?: number;
  weight_name?: string;
}

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  geometry: GeoJSON.LineString;
  maneuver: Maneuver;
  voiceInstructions?: VoiceInstruction[];
  bannerInstructions?: BannerInstruction[];
  intersections?: Intersection[];
  name?: string;
  mode?: string;
  weight?: number;
}

export interface Maneuver {
  type: string;
  instruction: string;
  bearing_after?: number;
  bearing_before?: number;
  location: [number, number]; // [lng, lat]
  modifier?: string;
}

export interface VoiceInstruction {
  distanceAlongGeometry: number;
  announcement: string;
  ssmlAnnouncement?: string;
}

export interface BannerInstruction {
  distanceAlongGeometry: number;
  primary: InstructionComponent;
  secondary?: InstructionComponent;
  sub?: InstructionComponent;
}

export interface InstructionComponent {
  text: string;
  components: Array<{
    text: string;
    type: string;
    abbreviation?: string;
    abbreviation_priority?: number;
  }>;
  type: string;
  modifier?: string;
}

export interface Intersection {
  location: [number, number];
  bearings: number[];
  entry: boolean[];
  in?: number;
  out?: number;
  lanes?: Lane[];
}

export interface Lane {
  valid: boolean;
  active: boolean;
  valid_indication?: string;
  indications: string[];
}

export interface Waypoint {
  coordinates: [number, number]; // [lng, lat]
  name?: string;
  waypoint_index?: number;
  distance?: number;
}

export interface RouteOptions {
  profile?: 'driving' | 'walking' | 'cycling' | 'driving-traffic';
  alternatives?: boolean;
  steps?: boolean;
  geometries?: 'geojson' | 'polyline' | 'polyline6';
  overview?: 'full' | 'simplified' | 'false';
  continue_straight?: boolean;
  waypoint_names?: string[];
  annotations?: string[];
  language?: string;
  roundtrip?: boolean;
  source?: 'first' | 'any';
  destination?: 'last' | 'any';
  approaches?: string[];
  radiuses?: number[];
  exclude?: string[];
}

export interface OptimizedRoute extends Route {
  originalOrder: [number, number][];
  optimizedOrder: number[];
  savings: {
    distance: number;
    duration: number;
  };
}

export interface DistanceMatrix {
  distances: number[][];
  durations: number[][];
  origins: [number, number][];
  destinations: [number, number][];
  sources?: Array<{
    distance: number;
    location: [number, number];
    name?: string;
  }>;
  destinations_points?: Array<{
    distance: number;
    location: [number, number];
    name?: string;
  }>;
}

export interface MatrixOptions {
  profile?: 'driving' | 'walking' | 'cycling' | 'driving-traffic';
  annotations?: string[];
  sources?: number[];
  destinations?: number[];
  fallback_speed?: number;
}

export interface NavigationSession {
  id: string;
  route: Route;
  startTime: Date;
  currentStep: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  options: NavigationOptions;
}

export interface NavigationOptions {
  profile?: 'driving' | 'walking' | 'cycling' | 'driving-traffic';
  voice?: boolean;
  banner?: boolean;
  language?: string;
  units?: 'metric' | 'imperial';
}

export interface NavigationUpdate {
  sessionId: string;
  currentLocation: [number, number];
  heading?: number;
  progress: RouteProgress;
  nextInstruction?: NextInstruction;
  deviation?: DeviationInfo;
  estimatedArrival: Date;
  rerouted: boolean;
}

export interface RouteProgress {
  currentStep: number;
  distanceRemaining: number;
  durationRemaining: number;
  distanceTraveled: number;
  fractionTraveled: number;
  remainingSteps: RouteStep[];
}

export interface NextInstruction {
  distance: number;
  instruction: string;
  type: string;
  modifier?: string;
  exit?: number;
  lane_instructions?: string[];
}

export interface DeviationInfo {
  distance: number; // meters off route
  shouldReroute: boolean;
  confidence: number;
}

export interface NavigationSummary {
  sessionId: string;
  startTime: Date;
  endTime: Date;
  plannedDuration: number;
  actualDuration: number;
  plannedDistance: number;
  actualDistance: number;
  completed: boolean;
}

export interface ETA {
  participantId: string;
  estimatedArrival: Date;
  durationSeconds: number;
  distanceMeters: number;
  calculatedAt: Date;
  confidence?: number;
}

export interface UsageStats {
  geocoding: {
    requests: number;
    cacheHits: number;
    errors: number;
  };
  routing: {
    requests: number;
    cacheHits: number;
    errors: number;
  };
  matrix: {
    requests: number;
    cacheHits: number;
    errors: number;
  };
  navigation: {
    sessions: number;
    errors: number;
  };
  totalCost: number;
  costByService: Record<string, number>;
}

export interface MapboxError {
  message: string;
  type: 'ProfileNotFound' | 'NoRoute' | 'NoSegment' | 'InvalidInput' | 'RateLimited' | 'Unauthorized' | 'Unknown';
  code?: string;
}

export interface CacheOptions {
  key: string;
  ttl: number;
  enabled: boolean;
}