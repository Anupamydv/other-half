export type CityId = 'bengaluru' | 'mumbai' | 'delhi' | 'hyderabad';

export type AppTab = 'explore' | 'map' | 'matches' | 'messages' | 'profile';
export type ExploreMode = 'feed' | 'swipe';
export type SwipeCategory = 'roommates' | 'rooms';
export type TravelMode = 'DRIVING' | 'WALKING' | 'TWO_WHEELER' | 'TRANSIT';

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface LandmarkPlace {
  id: string;
  name: string;
  category: 'famous' | 'new';
  area: string;
  tagline: string;
  position: LatLngLiteral;
}

export interface CityTheme {
  id: CityId;
  name: string;
  shortName: string;
  tagline: string;
  accentColor: string;
  secondaryColor: string;
  metroLine: string;
  center: LatLngLiteral;
  defaultOrigin: {
    label: string;
    position: LatLngLiteral;
  };
  neighborhoods: string[];
  landmarks: LandmarkPlace[];
}

export type SleepHabit = 'Early Bird' | 'Balanced' | 'Night Owl';
export type KitchenHabit = 'Pure Veg' | 'Eggetarian' | 'Non-Veg Friendly';
export type WorkHabit = 'WFH Mostly' | 'Hybrid' | 'Office Daily';
export type CleanlinessHabit = 'Neat Freak' | 'Tidy' | 'Relaxed';
export type SocialHabit = 'Quiet Sanctuary' | 'Balanced' | 'Social Host';

export interface LifestylePreferences {
  sleep: SleepHabit;
  kitchen: KitchenHabit;
  work: WorkHabit;
  cleanliness: CleanlinessHabit;
  social: SocialHabit;
  maxBudget: number;
  petFriendly: boolean;
  nonSmoker: boolean;
}

export interface RoommateProfile {
  id: string;
  name: string;
  age: number;
  role: string;
  company: string;
  cityId: CityId;
  neighborhood: string;
  avatar: string;
  photos: string[];
  bio: string;
  verifiedId: boolean;
  verifiedWork: boolean;
  mutualFriends: number;
  moveInWindow: string;
  rentBudget: number;
  preferences: LifestylePreferences;
  badges: string[];
  icebreakers: string[];
  hasFlatToOffer: boolean;
  flatTitle?: string;
  flatAddress?: string;
  flatPosition: LatLngLiteral;
  roomRent?: number;
  deposit?: number;
  utilitiesSplit?: {
    cook: number;
    maid: number;
    wifi: number;
    electricity: number;
  };
  roommatesCount?: number;
  nearbyHighlights: string[];
  mutualInterest: boolean;
}

export interface FeedComment {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface MediaAsset {
  id: string;
  kind: 'image' | 'video';
  url: string;
  caption?: string;
  storedBlobKey?: string;
}

export interface FeedPost {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  authorAvatar: string;
  verified: boolean;
  cityId: CityId;
  neighborhood: string;
  postType: 'Room Available' | 'Looking for Flatmate' | 'City Reel';
  caption: string;
  media: MediaAsset[];
  isWalkthroughReel?: boolean;
  likes: number;
  likedByMe: boolean;
  savedByMe: boolean;
  comments: FeedComment[];
  createdAt: string;
  rentPerMonth?: number;
  flatTitle?: string;
  flatPosition: LatLngLiteral;
  linkedProfileId?: string;
  tags: string[];
}

export interface ChatMessage {
  id: string;
  sender: 'me' | 'them' | 'system';
  text: string;
  timestamp: string;
  tourCard?: {
    date: string;
    timeSlot: string;
    mode: 'In-Person' | 'Live Video Tour';
    location: string;
  };
}

export interface Conversation {
  profileId: string;
  unread: boolean;
  messages: ChatMessage[];
}

export interface BookedTour {
  id: string;
  profileId: string;
  flatTitle: string;
  neighborhood: string;
  cityId: CityId;
  position: LatLngLiteral;
  date: string;
  timeSlot: string;
  mode: 'In-Person' | 'Live Video Tour';
  note: string;
  createdAt: string;
}

export interface UserSelfProfile {
  name: string;
  age: number;
  role: string;
  cityId: CityId;
  neighborhood: string;
  bio: string;
  quizCompleted: boolean;
  preferences: LifestylePreferences;
}
