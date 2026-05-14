import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen, 
  MessageSquare, 
  Headphones, 
  Settings, 
  Search, 
  Plus, 
  ChevronRight,
  TrendingUp,
  Award,
  Clock,
  Mic,
  Volume2,
  X,
  ChevronLeft,
  Layers,
  FileText, // 统一使用这个，删掉下方的 FileTextIcon
  Sparkles,
  Check,
  CheckSquare,
  Square,
  Ear,
  Trash2,
  Languages,
  Image as ImageIcon,
  Upload,
  RotateCcw,
  Briefcase,
  ShoppingBag,
  Plane,
  Coffee,
  CheckCircle,
  XCircle,
  LogIn,
  LogOut,
  User as UserIcon,
  RefreshCcw,
  ThumbsUp,
  Pause,
  Lightbulb,
  Target
} from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Word, Scenario, ChatMessage, ChatSession, Category } from './types';
import { getGeminiResponse, generateWordDetails, generatePodcastDialogue, parseScenarioFromImage } from './lib/gemini';
import { useSpeech } from './hooks/useSpeech';
import PodcastView from './components/PodcastView';
import { useAuth } from './components/AuthProvider';
import { auth, db, googleProvider } from './lib/firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import {
  getDocs,
  collection,
  query,
  where, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  writeBatch, 
  serverTimestamp 
} from 'firebase/firestore';

import { isWordDue } from './lib/ebbinghaus';
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEFAULT_SCENARIOS: Scenario[] = [
  // Workplace (11)
  {
    id: 'work-mtg',
    title: 'Business Meeting',
    description: 'A formal sync with global colleagues about project status.',
    category: 'Workplace',
    systemPrompt: 'You are a professional Project Manager. Conduct a status update meeting. Help the user sharpen their professional vocabulary.',
    initialMessage: 'Good morning. Let\'s dive into our project status. Who wants to start?'
  },
  {
    id: 'salary-neg',
    title: 'Salary Negotiation',
    description: 'Negotiating a pay raise with your manager based on performance.',
    category: 'Workplace',
    systemPrompt: 'You are a firm but fair Department Head. The user is asking for a raise. Challenge their achievements and ask for specific data.',
    initialMessage: 'I understand you wanted to discuss your compensation. Given the current budget, why do you feel a raise is justified now?'
  },
  {
    id: 'team-sync',
    title: 'Collaborative Sync',
    description: 'Practice professional English by coordinating a team meeting time and checking teammate availability.',
    category: 'Workplace',
    systemPrompt: 'You are a busy colleague. Respond to the user\'s request to schedule a meeting, mentioning your own prior commitments.',
    initialMessage: 'Hi! I saw your message about the team sync. My calendar is looking pretty packed this week, what did you have in mind?'
  },
  {
    id: 'job-interview',
    title: 'The Big Interview',
    description: 'A high-stakes behavioral interview for a senior role at a Fortune 500 company.',
    category: 'Workplace',
    systemPrompt: 'You are a Senior HR Director. Use STAR-method questions. Focus on leadership and conflict resolution.',
    initialMessage: 'Thank you for coming in. Tell me about a time you led a project through a significant crisis.'
  },
  {
    id: 'client-pitch',
    title: 'Selling the Dream',
    description: 'Pitching a new software solution to a skeptical potential client.',
    category: 'Workplace',
    systemPrompt: 'You are a CTO of a large corporation. You are skeptical about new software but open to clear ROI demonstrations.',
    initialMessage: 'We already have a solution in place. Why should we risk the migration to your platform?'
  },
  {
    id: 'annual-review',
    title: 'Annual Performance Review',
    description: 'A deep dive into your goals, achievements, and roadmap for the next year.',
    category: 'Workplace',
    systemPrompt: 'You are a supportive but demanding manager. Focus on specific KPIs and career growth paths.',
    initialMessage: 'Let\'s review your performance over the last 12 months. What are you most proud of?'
  },
  {
    id: 'office-conflict',
    title: 'Resolving Tension',
    description: 'Handling a disagreement with a peer over project resources.',
    category: 'Workplace',
    systemPrompt: 'You are a defensive colleague who feels overworked. The user needs you to handover some tasks.',
    initialMessage: 'I just don\'t see how I can give this up. It\'s my project, and I\'ve put months into it.'
  },
  {
    id: 'resignation',
    title: 'Graceful Exit',
    description: 'Resigning from your current position and discussing the notice period.',
    category: 'Workplace',
    systemPrompt: 'You are a surprised but professional manager. Ask about where the user is going and handle the logistics.',
    initialMessage: 'Oh, wow. I wasn\'t expecting this. I\'m sad to lose you. Can you tell me what prompted this decision?'
  },
  {
    id: 'project-kickoff',
    title: 'Project Kickoff',
    description: 'Setting expectations and delegating roles for a new cross-functional initiative.',
    category: 'Workplace',
    systemPrompt: 'You are the lead developer. You are concerned about the timeline and the scope of the project.',
    initialMessage: 'I\'ve reviewed the initial brief. Honestly, three months seems very tight for these features.'
  },
  {
    id: 'networking-event',
    title: 'Conference Networking',
    description: 'Engaging in small talk and exchanging contacts at an industry mixer.',
    category: 'Workplace',
    systemPrompt: 'You are a fellow attendee at a tech summit. Engage in natural networking conversation.',
    initialMessage: 'That was a great keynote on AI. Are you working in that space as well?'
  },
  {
    id: 'public-speaking',
    title: 'Keynote Rehearsal',
    description: 'Rehearsal session for an upcoming industry presentation.',
    category: 'Workplace',
    systemPrompt: 'You are a communications coach. Provide feedback on pacing, emphasis, and vocabulary choice.',
    initialMessage: 'Ready when you are. Let\'s hear the first three minutes of your presentation.'
  },

  // Shopping (11)
  {
    id: 'return-item',
    title: 'Returning an Item',
    description: 'Dealing with customer service to return a defective electronic product.',
    category: 'Shopping',
    systemPrompt: 'You are a helpful but policy-bound customer service representative. Ask for the receipt and explain the 30-day return window.',
    initialMessage: 'Welcome to TechHub Support. How can I assist you with your purchase today?'
  },
  {
    id: 'bulk-discount',
    title: 'Wholesale Negotiation',
    description: 'Negotiating price for a large order of office supplies.',
    category: 'Shopping',
    systemPrompt: 'You are a supplier looking to close a deal but protect your margins. Offer tiered discounts based on volume.',
    initialMessage: 'We appreciate your interest in our bulk catalog. What kind of quantities are we looking at for this quarter?'
  },
  {
    id: 'car-buying',
    title: 'The Car Dealership',
    description: 'Negotiating the final drive-away price and financing for a new vehicle.',
    category: 'Shopping',
    systemPrompt: 'You are a smooth car salesman. Try to upsell on features but don\'t lose the sale over a few hundred dollars.',
    initialMessage: 'She handles like a dream, doesn\'t she? Let\'s step into my office and look at the numbers.'
  },
  {
    id: 'clothes-shopping',
    title: 'Wardrobe Refresh',
    description: 'Asking for styling advice and checking for different sizes and colors in a boutique.',
    category: 'Shopping',
    systemPrompt: 'You are a trendy fashion consultant. Suggest modern styles and be honest about what looks good.',
    initialMessage: 'That coat is very "in" this season. Would you like to see how it looks in the navy blue?'
  },
  {
    id: 'grocery-store',
    title: 'Organic Selections',
    description: 'Inquiring about the source of produce and meat at a high-end grocery store.',
    category: 'Shopping',
    systemPrompt: 'You are an artisanal grocer. Be passionate about local sourcing and quality.',
    initialMessage: 'Those peaches just came in this morning from a farm up north. Can I help you find something specific?'
  },
  {
    id: 'tech-gadgets',
    title: 'Comparing Specs',
    description: 'Deciding between two high-end laptops based on technical requirements.',
    category: 'Shopping',
    systemPrompt: 'You are a tech enthusiast working in retail. Compare CPU, RAM, and GPU performance clearly.',
    initialMessage: 'For video editing, the M3 chip is going to save you hours. What kind of software are you running?'
  },
  {
    id: 'gift-finding',
    title: 'The Perfect Gift',
    description: 'Consulting a gift specialist to find something unique for a person who "has everything".',
    category: 'Shopping',
    systemPrompt: 'You are a creative gift curator. Ask about the recipient\'s personality and hobbies.',
    initialMessage: 'Finding something for a person who has everything is my specialty. Tell me about their interests.'
  },
  {
    id: 'online-delay',
    title: 'Missing Package',
    description: 'Calling a logistics company to track a high-value shipment that is stuck in customs.',
    category: 'Shopping',
    systemPrompt: 'You are a customer service rep at a major courier. Be apologetic but explain the customs process.',
    initialMessage: 'I see your tracking status indicates a "Customs Hold". Let me look into that for you.'
  },
  {
    id: 'watch-auth',
    title: 'Luxury Authentication',
    description: 'Buying a pre-owned vintage watch and verifying its provenance.',
    category: 'Shopping',
    systemPrompt: 'You are a reputable horologist. Explain what to look for in terms of serial numbers and movement marks.',
    initialMessage: 'A beautiful piece from 1968. If you look here under a loupe, you can see the original etching.'
  },
  {
    id: 'real-estate',
    title: 'Apartment Viewing',
    description: 'Viewing a luxury rental and asking about amenities, lease terms, and utilities.',
    category: 'Shopping',
    systemPrompt: 'You are a professional real estate agent. Highlight the view and the quiet neighborhood.',
    initialMessage: 'Welcome! This unit just came on the market. It\'s the best layout in the entire building.'
  },
  {
    id: 'pawn-shop',
    title: 'Pawn Star Negotiation',
    description: 'Trying to sell an antique heirloom for the highest possible price.',
    category: 'Shopping',
    systemPrompt: 'You are a savvy pawn shop owner. Point out flaws but show genuine interest in unique items.',
    initialMessage: 'It\'s an interesting piece, but the market for silver tea sets is a bit slow right now. What were you thinking?'
  },

  // Daily (11)
  {
    id: 'doctor-appt',
    title: 'Doctor\'s Appointment',
    description: 'Explaining symptoms and medical history to a general practitioner.',
    category: 'Daily',
    systemPrompt: 'You are a thorough GP. Ask diagnostic questions about the user\'s symptoms, duration, and pain levels.',
    initialMessage: 'Good afternoon. What brings you in today? I see from your chart you\'ve been feeling unwell.'
  },
  {
    id: 'fancy-dinner',
    title: 'Fine Dining Order',
    description: 'Ordering a multi-course meal and asking about wine pairings.',
    category: 'Daily',
    systemPrompt: 'You are an elegant sommelier and waiter. Describe the specials in detail and suggest pairings.',
    initialMessage: 'Good evening. Our chef has prepared a remarkable truffle risotto tonight. May I start you with an aperitif?'
  },
  {
    id: 'coffee-shop',
    title: 'The Busy Barista',
    description: 'Ordering a highly specific custom drink during the morning rush.',
    category: 'Daily',
    systemPrompt: 'You are a fast-paced barista in a trendy city cafe. Be efficient but polite.',
    initialMessage: 'Morning! What can I get started for you? We have a fresh batch of Ethiopian roast today.'
  },
  {
    id: 'gym-trainer',
    title: 'Personal Training',
    description: 'Discussing fitness goals and dietary habits with a new trainer.',
    category: 'Daily',
    systemPrompt: 'You are a motivational and science-based fitness coach. Focus on consistency and form.',
    initialMessage: 'Welcome to the club. Let\'s talk about your "why". What are we looking to achieve in the next 90 days?'
  },
  {
    id: 'bank-opening',
    title: 'Opening a Bank Account',
    description: 'Navigating different account types, interest rates, and fee structures.',
    category: 'Daily',
    systemPrompt: 'You are a helpful bank teller. Explain the difference between savings and checking accounts clearly.',
    initialMessage: 'Good morning. I see you\'re interested in our Premium Advantage account. Do you have your ID with you?'
  },
  {
    id: 'post-office',
    title: 'Shipping Overseas',
    description: 'Inquiring about shipping times, insurance, and tracking for a fragile international package.',
    category: 'Daily',
    systemPrompt: 'You are a methodical postal clerk. Ask about the contents and the declared value.',
    initialMessage: 'Where are we sending this today? And are there any hazardous materials inside?'
  },
  {
    id: 'book-club',
    title: 'Book Club Discussion',
    description: 'Analyzing a complex novel with fellow literature enthusiasts.',
    category: 'Daily',
    systemPrompt: 'You are an insightful member of a high-brow book club. Discuss themes of existentialism and metaphor.',
    initialMessage: 'I found the protagonist\'s motivations quite confusing in the third chapter. What did you make of the bridge scene?'
  },
  {
    id: 'neighbor-issue',
    title: 'Neighbor Conflict',
    description: 'Politely but firmly addressing a noise issue or a property boundary disagreement.',
    category: 'Daily',
    systemPrompt: 'You are a neighbor who plays music late but didn\'t realize it was bothering anyone. Be receptive but a bit defensive.',
    initialMessage: 'Oh, hey! Is the music too loud? I was just celebrating a friend\'s birthday.'
  },
  {
    id: 'parent-teacher',
    title: 'Parent-Teacher Meeting',
    description: 'Discussing a child\'s academic progress and social behavior with their teacher.',
    category: 'Daily',
    systemPrompt: 'You are a dedicated primary school teacher. Mention specific strengths and areas for improvement.',
    initialMessage: 'Thanks for coming in. Your son/daughter is doing great in math, but I\'ve noticed some hesitancy in group work.'
  },
  {
    id: 'haircut',
    title: 'The Hair Salon',
    description: 'Describing a new hairstyle and discussing maintenance and products.',
    category: 'Daily',
    systemPrompt: 'You are a creative hairstylist. Suggest what would work with the user\'s face shape.',
    initialMessage: 'Looking for a big change today, or just a trim? I think some layers would really suit you.'
  },
  {
    id: 'vet-visit',
    title: 'Emergency Vet Visit',
    description: 'Explaining a pet\'s symptoms and discussing treatment options and costs.',
    category: 'Daily',
    systemPrompt: 'You are a calm and empathetic veterinarian. Ask about appetite, energy levels, and any recent changes.',
    initialMessage: 'I understand Fluffy isn\'t feeling her best. When did you first notice she stopped eating?'
  },

  // Travel (11)
  {
    id: 'hotel-overbook',
    title: 'Hotel Overbooking',
    description: 'Resolving a situation where the hotel lost your reservation.',
    category: 'Travel',
    systemPrompt: 'You are a stressed front desk manager. Apologize profusely but mention that the city is fully booked for a conference.',
    initialMessage: 'I am so incredibly sorry, sir/ma\'am. I see your confirmation number, but we currently have no rooms available in our system.'
  },
  {
    id: 'hidden-gems',
    title: 'Local Recommendations',
    description: 'Asking a local at a cafe about non-touristy places to visit.',
    category: 'Travel',
    systemPrompt: 'You are a friendly local who loves your city. Suggest specific neighborhoods and small shops.',
    initialMessage: 'Oh, you definitely want to skip the main square. Are you into art or more of a foodie type?'
  },
  {
    id: 'lost-passport',
    title: 'Lost Passport',
    description: 'Reporting a lost passport at the embassy and applying for an emergency travel document.',
    category: 'Travel',
    systemPrompt: 'You are a strict but efficient consular officer. Ask for identification and explain the processing time.',
    initialMessage: 'Please have a seat. I understand you\'ve had a security incident with your travel documents?'
  },
  {
    id: 'airport-checkin',
    title: 'Airport Check-in',
    description: 'Dealing with overweight bags, seat upgrades, and a potential flight delay.',
    category: 'Travel',
    systemPrompt: 'You are a professional airline gate agent. Enforce the weight limit but check for any available upgrades.',
    initialMessage: 'Welcome to Global Airways. May I see your passport? And will you be checking any bags today?'
  },
  {
    id: 'car-rental',
    title: 'Rental Car Pick-up',
    description: 'Inquiring about insurance coverage, fuel policies, and road-side assistance.',
    category: 'Travel',
    systemPrompt: 'You are a helpful rental clerk. Try to sell the collision damage waiver (CDW) but don\'t be too pushy.',
    initialMessage: 'I have a nice SUV ready for you. Would you like to add our premium protection plan for $15 a day?'
  },
  {
    id: 'train-station',
    title: 'The Last Train',
    description: 'Buying a ticket for a complex multi-leg journey at a busy foreign station.',
    category: 'Travel',
    systemPrompt: 'You are a fast-speaking ticket agent. Use terms like "connection", "platform", and "layover".',
    initialMessage: 'Next in line! Where to? The 2:15 to Paris is departing in five minutes, you\'ll have to hurry.'
  },
  {
    id: 'guided-tour',
    title: 'Art Museum Tour',
    description: 'Asking detailed questions about a specific painting and its historical context.',
    category: 'Travel',
    systemPrompt: 'You are an expert art historian and guide. Be very detailed about brushwork and symbolism.',
    initialMessage: 'If you look at the way the light hits the canvas here, you can see the artist\'s shift towards Impressionism.'
  },
  {
    id: 'customs-immigration',
    title: 'Immigration Interview',
    description: 'Explaining your travel purpose, duration, and accommodation details to an officer.',
    category: 'Travel',
    systemPrompt: 'You are a serious immigration officer. Ask for proof of return and sufficient funds.',
    initialMessage: 'Purpose of your visit to the United Kingdom? And how long do you intend to stay?'
  },
  {
    id: 'lost-property',
    title: 'Lost at the Museum',
    description: 'Inquiring about a lost camera or bag at the "Lost and Found" department.',
    category: 'Travel',
    systemPrompt: 'You are a tired but helpful security guard. Ask for a detailed description of the item.',
    initialMessage: 'I have several bags here. Can you describe yours? What brand was it, and what color?'
  },
  {
    id: 'airbnb-checkin',
    title: 'AirBnB Host Welcome',
    description: 'Meeting your host and asking about the trash, Wi-Fi, and house rules.',
    category: 'Travel',
    systemPrompt: 'You are an enthusiastic AirBnB host. Give a "local tour" of the apartment and suggest a nearby cafe.',
    initialMessage: 'So glad you made it! Here are the keys. The Wi-Fi password is on the fridge. Any questions?'
  },
  {
    id: 't-station-directions',
    title: 'Lost in the City',
    description: 'Asking for directions to a specific landmark using local landmarks as reference.',
    category: 'Travel',
    systemPrompt: 'You are a hurried but kind pedestrian. Use directions like "take a left", "walk two blocks", and "across from".',
    initialMessage: 'The Louvre? Oh, you\'re headed the wrong way. You need to cross the river first.'
  },

  // Other (11)
  {
    id: 'tech-support',
    title: 'IT Help Desk',
    description: 'Troubleshooting a complex software issue over the phone.',
    category: 'Other',
    systemPrompt: 'You are a patient but technical support agent. Use specific terminology like "cache", "registry", and "reboot".',
    initialMessage: 'Thanks for calling IT Support. I understand your workstation is throwing a 404 error on the internal portal?'
  },
  {
    id: 'insurance-claim',
    title: 'Insurance Claim',
    description: 'Reporting a car accident and filing a claim with an insurance representative.',
    category: 'Other',
    systemPrompt: 'You are a methodical insurance adjuster. Ask about the date, location, and any witnesses to the event.',
    initialMessage: 'I\'m sorry to hear about the accident. Let\'s get the details down so we can process your claim.'
  },
  {
    id: 'legal-consult',
    title: 'Legal Consultation',
    description: 'Discussing a contract dispute or a tenant rights issue with a lawyer.',
    category: 'Other',
    systemPrompt: 'You are a precise and analytical attorney. Focus on the language of the contract and potential liability.',
    initialMessage: 'I\'ve reviewed the document you sent over. Clause 4.b is particularly problematic for our case.'
  },
  {
    id: 'university-admin',
    title: 'Campus Enrollment',
    description: 'Inquiring about course prerequisites, credits, and waitlists at a registrar\'s office.',
    category: 'Other',
    systemPrompt: 'You are an efficient university administrator. Use terms like "transcript", "syllabus", and "audit".',
    initialMessage: 'Welcome to the Registrar\'s office. I see you want to add Advanced Econometrics, but you haven\'t completed the pre-req.'
  },
  {
    id: 'community-volunteer',
    title: 'Volunteering',
    description: 'Asking about opportunities and requirements at a local animal shelter.',
    category: 'Other',
    systemPrompt: 'You are a passionate volunteer coordinator. Ask about availability and animal experience.',
    initialMessage: 'We are always looking for help! Would you be interested in walking dogs or helping with the adoption events?'
  },
  {
    id: 'library-research',
    title: 'Library Research',
    description: 'Consulting a librarian to find obscure primary sources for a thesis.',
    category: 'Other',
    systemPrompt: 'You are a knowledgeable reference librarian. Suggest using specific databases and microfiche archives.',
    initialMessage: 'That\'s a niche topic. We should check the digital archives of the 19th-century trade journals.'
  },
  {
    id: 'public-debate',
    title: 'Debate Practice',
    description: 'Defending a controversial position against a sharp opponent to improve logic and speed.',
    category: 'Other',
    systemPrompt: 'You are a skilled debater. Use logical fallacies for the user to point out and counter-arguments.',
    initialMessage: 'Your premise seems fundamentally flawed. How can you argue for X when Y is clearly the case?'
  },
  {
    id: 'career-coaching',
    title: 'Career Switch',
    description: 'Discussing a transition from one industry to another and optimizing a resume.',
    category: 'Other',
    systemPrompt: 'You are an insightful career coach. Help the user identify "transferable skills".',
    initialMessage: 'Moving from marketing to data science is a big jump. What technical projects have you worked on?'
  },
  {
    id: 'charity-gala',
    title: 'The Charity Gala',
    description: 'Engaging in formal small talk and discussing social impact with potential donors.',
    category: 'Other',
    systemPrompt: 'You are a wealthy philanthropist. Focus on long-term sustainability and community impact.',
    initialMessage: 'I\'m curious about your foundation\'s work. How do you measure the success of your education program?'
  },
  {
    id: 'financial-planning',
    title: 'Legacy Planning',
    description: 'Discussing retirement goals and investment strategies with a financial advisor.',
    category: 'Other',
    systemPrompt: 'You are a conservative financial advisor. Focus on risk management and tax-efficient strategies.',
    initialMessage: 'Based on your age and goals, I think your current portfolio is a bit too aggressive. Shall we rebalance?'
  },
  {
    id: 'media-interview',
    title: 'Media Interview',
    description: 'Handling difficult questions from a journalist about a corporate controversy.',
    category: 'Other',
    systemPrompt: 'You are a persistent investigative reporter. Ask follow-up questions to uncover the "truth".',
    initialMessage: 'Your company claims it had no prior knowledge of the leak, but internal emails suggest otherwise. Comment?'
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'book' | 'review' | 'chat'>('book');
  const [words, setWords] = useState<Word[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>(DEFAULT_SCENARIOS);
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  const [learningWords, setLearningWords] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Workplace');
  const [isAddingWord, setIsAddingWord] = useState(false);
  const [isAddingScenario, setIsAddingScenario] = useState(false);
  const [scenarioMode, setScenarioMode] = useState<'selection' | 'manual' | 'image'>('selection');
  const [newWordInput, setNewWordInput] = useState('');
  const [addWordTab, setAddWordTab] = useState<'text' | 'voice' | 'image'>('text');
  const [batchProgress, setBatchProgress] = useState<{ total: number; done: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [returnTab, setReturnTab] = useState<'book' | 'review'>('book');
  const [mode, setMode] = useState<'normal' | 'flashcard' | 'podcast' | 'spelling' | 'pronounce'>('normal');
  const [podcastData, setPodcastData] = useState<any>(null);
  const [inspectedWord, setInspectedWord] = useState<{ text: string, details: any } | null>(null);
  const [reviewQueue, setReviewQueue] = useState<Word[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showDueWords, setShowDueWords] = useState(false);
  const [isWordDialogueModalOpen, setIsWordDialogueModalOpen] = useState(false);
  const [wordDialogueSelected, setWordDialogueSelected] = useState<Set<string>>(new Set());
  const [wordDialogueTargetWords, setWordDialogueTargetWords] = useState<string[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [resumedMessages, setResumedMessages] = useState<ChatMessage[] | null>(null);
  const { user } = useAuth();
  const { speak, listen, isListening, cancel } = useSpeech();

  const dueWords = words.filter(w => isWordDue(w.lastReviewedAt, w.createdAt, w.masteryLevel));

  const handleReviewComplete = async (wordId: string, success: boolean) => {
    // If failed, reset to level 0 to ensure it appears in review queue immediately/more frequently
    const currentWord = words.find(w => w.id === wordId);
    if (!currentWord) return;

    const nextLevel = success 
      ? Math.min(currentWord.masteryLevel + 1, 8) 
      : 0; // Aggressive reset to level 0 for failed tokens
    
    const updatedWords = words.map(w => w.id === wordId ? { ...w, masteryLevel: nextLevel, lastReviewedAt: Date.now() } : w);
    setWords(updatedWords);

    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid, 'words', wordId), {
          masteryLevel: nextLevel,
          lastReviewedAt: Date.now()
        });
      } catch (e) {
        console.error(e);
      }
    } else {
      localStorage.setItem('lexiloop_words', JSON.stringify(updatedWords));
    }
  };

  // Handle word selection
  const handleExitMode = () => {
    setMode('normal');
    setActiveTab(returnTab);
  };

  const handleLogin = () => signInWithPopup(auth, googleProvider);
  const handleLogout = () => signOut(auth);

  const toggleSelection = (id: string) => {
    const next = new Set(selectedWordIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedWordIds(next);
  };

  const selectAll = () => {
    if (selectedWordIds.size === words.length) setSelectedWordIds(new Set());
    else setSelectedWordIds(new Set(words.map(w => w.id)));
  };

  const toggleWordDialogueSelection = (id: string) => {
    setWordDialogueSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 5) next.add(id);
      return next;
    });
  };

  // Logic to generate gossip article
  const handleGeneratePodcast = async () => {
    const targetWords = words.filter(w => selectedWordIds.has(w.id)).map(w => w.text);
    if (targetWords.length === 0) return;
    setLearningWords(targetWords);
    setIsLoading(true);
    setReturnTab('book');
    setMode('podcast');
    setPodcastData(null);
    setIsSelectionMode(false);
    setSelectedWordIds(new Set());
    try {
      const data = await generatePodcastDialogue(targetWords);
      if (data && data.lines) {
        setPodcastData(data);
      } else {
        setMode('normal');
      }
    } catch (e) {
      console.error("Generation error:", e);
      setMode('normal');
    }
    setIsLoading(false);
  };

  const handleRegeneratePodcast = async () => {
    if (learningWords.length === 0) return;
    setIsLoading(true);
    setPodcastData(null);
    try {
      const data = await generatePodcastDialogue(learningWords);
      if (data && data.lines) {
        setPodcastData(data);
      } else {
        setMode('normal');
      }
    } catch (e) {
      console.error("Regeneration error:", e);
      setMode('normal');
    }
    setIsLoading(false);
  };

  const handleStartSelection = () => {
    setIsSelectionMode(true);
    setSelectedWordIds(new Set());
  };

  const handleStartWordDialogue = () => {
    const selectedWords = words.filter(w => wordDialogueSelected.has(w.id)).map(w => w.text);
    if (selectedWords.length === 0 || selectedWords.length > 5) return;

    setIsWordDialogueModalOpen(false);
    setWordDialogueSelected(new Set());
    setWordDialogueTargetWords(selectedWords);

    const wordList = selectedWords.join(', ');
    const scenario: Scenario = {
      id: `word-dialogue-${Date.now()}`,
      title: `词汇练习`,
      description: `围绕 ${selectedWords.length} 个核心词汇的对话练习`,
      category: 'Workplace',
      systemPrompt: `你现在是一个口语教练。用户选择了以下核心词汇：[${wordList}]。
请根据这些单词自动推断一个合理的职场或生活场景，并开启对话。
在对话中，你必须主动使用这些单词，并引导或鼓励用户也在回复中尝试使用它们。
单词出现时请在对话中加粗（用 **word** 格式）。
每次回复后给出简短正向反馈，鼓励用户继续使用目标词汇。`,
      initialMessage: `Let's practice! I've prepared a conversation for you around these words: **${wordList}**. Ready to begin?`
    };

    setSelectedScenario(scenario);
  };

  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedWordIds(new Set());
  };

  const resumeSession = (session: ChatSession) => {
    const found = scenarios.find(s => s.id === session.scenarioId) || {
      id: session.scenarioId,
      title: session.title,
      description: '',
      category: 'Other' as Category,
      systemPrompt: 'Continue the conversation naturally.',
      initialMessage: '',
    };
    setSelectedScenario(found);
    setResumedMessages(session.messages);
    setWordDialogueTargetWords(session.targetWords || []);
  };

  useEffect(() => {
    const loadData = async () => {
      if (user) {
        setIsLoading(true);
        try {
          // Load Words
          const wordsQuery = query(
          collection(db, "users", user.uid, "words")
          );
          const wordsSnap = await getDocs(wordsQuery);
          const cloudWords = wordsSnap.docs.map(d => d.data() as Word);
          
          // Merge with Local (Migration)
          const localStored = localStorage.getItem('lexiloop_words');
          if (localStored) {
            const localWords = JSON.parse(localStored) as Word[];
            const batch = writeBatch(db);
            let migrationCount = 0;
            
            const merged = [...cloudWords];
            localWords.forEach(lw => {
              if (!cloudWords.find(cw => cw.id === lw.id)) {
                const wordWithUser = { ...lw, userId: user.uid };
                const wordRef = doc(db, 'users', user.uid, 'words', lw.id);
                batch.set(wordRef, wordWithUser);
                merged.push(wordWithUser);
                migrationCount++;
              }
            });

            if (migrationCount > 0) {
              await batch.commit();
              localStorage.removeItem('lexiloop_words');
            }
            setWords(dedupWords(merged));
          } else {
            setWords(dedupWords(cloudWords));
          }

          // Load Scenarios
         const scenariosQuery = query(
           collection(db, "scenarios"),
           where("userId", "==", user.uid)
           );
          const scenariosSnap = await getDocs(scenariosQuery);
          const cloudScenarios = scenariosSnap.docs.map(d => d.data() as Scenario);
          
          const localScenariosStored = localStorage.getItem('lexiloop_scenarios');
          if (localScenariosStored) {
            const localScenarios = JSON.parse(localScenariosStored) as Scenario[];
            const sBatch = writeBatch(db);
            
            const mergedS = [...DEFAULT_SCENARIOS, ...cloudScenarios];
            localScenarios.forEach(ls => {
              if (!cloudScenarios.find(cs => cs.id === ls.id)) {
                const sWithUser = { ...ls, userId: user.uid };
                const sRef = doc(db, 'scenarios', ls.id);
                sBatch.set(sRef, sWithUser);
                mergedS.push(sWithUser);
              }
            });
            await sBatch.commit();
            localStorage.removeItem('lexiloop_scenarios');
            setScenarios(mergedS);
          } else {
            setScenarios([...DEFAULT_SCENARIOS, ...cloudScenarios]);
          }

          // Load Chat Sessions (deduplicate by scenarioId, keep latest)
          const sessionsQuery = query(collection(db, "users", user.uid, "chat_sessions"));
          const sessionsSnap = await getDocs(sessionsQuery);
          const allSessions = sessionsSnap.docs.map(d => d.data() as ChatSession);
          const sessionMap = new Map<string, ChatSession>();
          allSessions.forEach(s => {
            const existing = sessionMap.get(s.scenarioId);
            if (!existing || s.updatedAt > existing.updatedAt) sessionMap.set(s.scenarioId, s);
          });
          setChatSessions(Array.from(sessionMap.values()).sort((a, b) => b.updatedAt - a.updatedAt));

        } catch (e) {
          console.error("Error loading user data:", e);
        } finally {
          setIsLoading(false);
        }
      } else {
        // Fallback to local
        const stored = localStorage.getItem('lexiloop_words');
        if (stored) setWords(dedupWords(JSON.parse(stored)));
        
        const storedScenarios = localStorage.getItem('lexiloop_scenarios');
        if (storedScenarios) {
          setScenarios([...DEFAULT_SCENARIOS, ...JSON.parse(storedScenarios)]);
        }

        const storedSessions = localStorage.getItem('lexiloop_chat_sessions');
        if (storedSessions) {
          setChatSessions(JSON.parse(storedSessions));
        }
      }
    };

    loadData();
  }, [user]);

  // Deduplicate words: same text on the same day, keep only the latest
  const dedupWords = (raw: Word[]): Word[] => {
    const map = new Map<string, Word>();
    for (const w of raw) {
      const day = new Date(w.createdAt).toLocaleDateString('en-CA'); // YYYY-MM-DD
      const key = `${day}_${w.text.toLowerCase()}`;
      const existing = map.get(key);
      if (!existing || w.createdAt > existing.createdAt) {
        map.set(key, w);
      }
    }
    return Array.from(map.values());
  };

  const saveWords = (newWordsOrFn: Word[] | ((prev: Word[]) => Word[])) => {
    if (typeof newWordsOrFn === 'function') {
      setWords(prev => {
        const next = newWordsOrFn(prev);
        if (!user) localStorage.setItem('lexiloop_words', JSON.stringify(next));
        return next;
      });
    } else {
      setWords(newWordsOrFn);
      if (!user) localStorage.setItem('lexiloop_words', JSON.stringify(newWordsOrFn));
    }
  };

  const saveChatSessions = (updater: ChatSession[] | ((prev: ChatSession[]) => ChatSession[])) => {
    if (typeof updater === 'function') {
      setChatSessions(prev => {
        const next = updater(prev);
        if (!user) localStorage.setItem('lexiloop_chat_sessions', JSON.stringify(next));
        return next;
      });
    } else {
      setChatSessions(updater);
      if (!user) localStorage.setItem('lexiloop_chat_sessions', JSON.stringify(updater));
    }
  };

  const saveScenario = async (newScenario: Scenario) => {
    const customOnly = scenarios.filter(s => !DEFAULT_SCENARIOS.find(ds => ds.id === s.id));
    const nextCustom = [newScenario, ...customOnly];
    setScenarios([...DEFAULT_SCENARIOS, ...nextCustom]);

    if (user) {
      try {
        await setDoc(doc(db, 'scenarios', newScenario.id), { ...newScenario, userId: user.uid });
      } catch (e) {
        console.error(e);
      }
    } else {
      localStorage.setItem('lexiloop_scenarios', JSON.stringify(nextCustom));
    }

    setIsAddingScenario(false);
    setScenarioMode('selection');
    setSelectedScenario(newScenario);
  };

  const handleAddWord = async (text: string, skipClose?: boolean) => {
    if (!text) return;
    setIsLoading(true);
    try {
      const details = await generateWordDetails(text);
      if (details) {
        const newWord: Word = {
          id: crypto.randomUUID(),
          text,
          ukPhonetic: details.ukPhonetic,
          usPhonetic: details.usPhonetic,
          pos: details.pos,
          definition: details.definition,
          examples: details.examples,
          collocations: details.collocations,
          category: 'Workplace',
          createdAt: Date.now(),
          masteryLevel: 0,
          tags: []
        };

        if (user) {
          await setDoc(doc(db, 'users', user.uid, 'words', newWord.id), { ...newWord });
        }
        saveWords(prev => {
          if (prev.some(w => w.text.toLowerCase() === text.toLowerCase())) return prev;
          return [newWord, ...prev];
        });
      }
    } catch (e) {
      console.error("Error adding word:", e);
    } finally {
      setIsLoading(false);
      if (!skipClose) {
        setIsAddingWord(false);
        setNewWordInput('');
      }
    }
  };

  const handleBatchAdd = async (input: string) => {
    const normalized = [...new Set(
      input.split(/[,，\n;；\s]+/).map(w => w.trim()).filter(Boolean)
    )];
    const newWords = normalized.filter(
      w => !words.some(ew => ew.text.toLowerCase() === w.toLowerCase())
    );
    if (newWords.length === 0) {
      setIsAddingWord(false);
      setNewWordInput('');
      return;
    }

    setBatchProgress({ total: newWords.length, done: 0 });

    for (let i = 0; i < newWords.length; i++) {
      await handleAddWord(newWords[i], true);
      setBatchProgress({ total: newWords.length, done: i + 1 });
    }

    setBatchProgress(null);
    setIsAddingWord(false);
    setNewWordInput('');
  };

  const handleRefreshWord = async (id: string, text: string) => {
    setIsLoading(true);
    const details = await generateWordDetails(text);
    if (details) {
      const updatedWords = words.map(w => w.id === id ? {
        ...w,
        ukPhonetic: details.ukPhonetic,
        usPhonetic: details.usPhonetic,
        pos: details.pos,
        definition: details.definition,
        examples: details.examples,
        collocations: details.collocations,
      } : w);
      
      if (user) {
        try {
          await updateDoc(doc(db, 'users', user.uid, 'words', id), {
            ukPhonetic: details.ukPhonetic,
            usPhonetic: details.usPhonetic,
            pos: details.pos,
            definition: details.definition,
            examples: details.examples,
            collocations: details.collocations,
          });
        } catch (e) {
          console.error(e);
        }
      }
      saveWords(updatedWords);
    }
    setIsLoading(false);
  };

  const handleDeleteWord = async (id: string) => {
    saveWords(prev => prev.filter(w => w.id !== id));

    if (user) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'words', id));
      } catch (e) {
        console.error(e);
      }
    }

    if (selectedWordIds.has(id)) {
      const next = new Set(selectedWordIds);
      next.delete(id);
      setSelectedWordIds(next);
    }
  };

  const handleInspect = async (word: string) => {
    setIsInspecting(true);
    const details = await generateWordDetails(word);
    if (details) {
      setInspectedWord({ text: word, details });
    }
    setIsInspecting(false);
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] text-slate-900 font-sans">
      <div className="w-full max-w-[600px] mx-auto min-h-screen flex flex-col relative">

      {/* Top Nav (desktop) / Bottom Nav (mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 w-full bg-white/80 backdrop-blur-xl border-t border-black/[0.04] flex items-center justify-around py-2 z-50 lg:max-w-[600px] lg:left-1/2 lg:-translate-x-1/2">
        {/* Logo */}
        <div className="hidden lg:flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">L</div>
          <span className="font-bold text-base tracking-tight text-slate-900">LexiLoop</span>
        </div>
        <div className="flex lg:hidden items-center gap-1.5">
          <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl flex items-center justify-center text-white font-bold text-[10px]">L</div>
          <span className="font-bold text-[10px] tracking-tight text-slate-900">LexiLoop</span>
        </div>

        {/* Tabs: sliding segmented control on desktop */}
        <div className="hidden lg:flex flex-1 justify-center">
          <div className="flex bg-slate-100 rounded-2xl p-1">
            {[
              { key: 'book' as const, icon: <BookOpen size={16} />, label: '生词本' },
              { key: 'chat' as const, icon: <MessageSquare size={16} />, label: '对话练习' },
              { key: 'review' as const, icon: <Headphones size={16} />, label: '背单词' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setMode('normal'); }}
                className={cn(
                  "relative z-10 flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-medium transition-colors",
                  activeTab === tab.key ? "text-white" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {activeTab === tab.key && (
                  <motion.div
                    layoutId="nav-tab-indicator"
                    className="absolute inset-0 bg-slate-900 rounded-xl"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  {tab.icon}
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex lg:hidden">
          <NavIcon icon={<BookOpen size={20} />} active={activeTab === 'book'} onClick={() => { setActiveTab('book'); setMode('normal'); }} label="生词本" />
          <NavIcon icon={<MessageSquare size={20} />} active={activeTab === 'chat'} onClick={() => { setActiveTab('chat'); setMode('normal'); }} label="对话练习" />
          <NavIcon icon={<Headphones size={20} />} active={activeTab === 'review'} onClick={() => { setActiveTab('review'); setMode('normal'); }} label="背单词" />
        </div>

        {/* User Avatar / Login: right on desktop */}
        <div className="flex items-center justify-center shrink-0">
          {user ? (
            <button onClick={handleLogout} className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-slate-200 hover:ring-blue-300 transition-all">
              <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} referrerPolicy="no-referrer" alt="Avatar" className="w-full h-full object-cover" />
            </button>
          ) : (
            <button onClick={handleLogin} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 transition-all">
              <UserIcon size={16} />
            </button>
          )}
        </div>
      </nav>

      {/* Main Container */}
      <main className="pb-20 lg:pb-4 flex-1 overflow-y-auto">
        <div className="mx-auto px-5 lg:px-6 py-6">
          
          <header className="flex items-center justify-between gap-3 mb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                {activeTab === 'book' && (mode === 'flashcard' ? "Immersion Flashcards" : mode === 'podcast' ? "知识进到脑子里" : "生词本")}
                {activeTab === 'review' && "背单词"}
                {activeTab === 'chat' && (selectedScenario ? selectedScenario.title : "对话练习")}
              </h1>
              <p className="text-slate-500 mt-1 font-medium text-sm">
                {activeTab === 'book' && (mode === 'normal' ? `${words.length} items logged` : "Refining through synthesis")}
                {activeTab === 'review' && "科学记忆曲线驱动"}
                {activeTab === 'chat' && "AI-enhanced professional practice"}
              </p>
            </div>

            {mode !== 'normal' && (
               <button onClick={handleExitMode} className="text-slate-500 hover:text-slate-900 font-semibold text-sm flex items-center gap-1 bg-white px-4 py-2 rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition-all shrink-0">
                 <ChevronLeft size={14} /> 返回
               </button>
            )}

          </header>

          <AnimatePresence mode="wait">
            {activeTab === 'book' && mode === 'normal' && (
              <motion.div key="book-root" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                {/* Top Action Row */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Left Card: Add Word */}
                  <div
                    onClick={() => setIsAddingWord(true)}
                    className="bg-white p-5 rounded-3xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex flex-col items-center justify-center text-center space-y-3 cursor-pointer active:scale-[0.97] transition-all group"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Plus size={24} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold tracking-tight text-slate-900">录入生词</h3>
                      <p className="text-slate-500 text-sm mt-0.5">快捷录入表达</p>
                    </div>
                  </div>

                  {/* Right Card: Generate Gossip Story */}
                  <div
                    onClick={isSelectionMode ? undefined : handleStartSelection}
                    className={cn(
                      "p-5 rounded-3xl border-2 flex flex-col items-center justify-center text-center space-y-3 transition-all duration-500",
                      isSelectionMode
                        ? "bg-blue-50 border-blue-200"
                        : selectedWordIds.size > 0
                          ? "bg-emerald-50/50 border-emerald-100 cursor-pointer shadow-xl"
                          : "bg-white border-slate-200/60 hover:border-blue-300 cursor-pointer shadow-[0_2px_12px_rgba(0,0,0,0.04)] active:scale-[0.97]"
                    )}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500",
                      isSelectionMode ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400 group-hover:scale-110"
                    )}>
                      {isSelectionMode ? <Check size={24} /> : <FileText size={24} />}
                    </div>

                    <div>
                      <h3 className="text-sm font-bold">
                        {isSelectionMode ? "勾选单词" : "情景化阅读"}
                      </h3>
                      <p className="text-gray-400 text-[10px] mt-0.5">
                        {isSelectionMode
                          ? `已选 ${selectedWordIds.size} 个词`
                          : "趣味阅读加深记忆"}
                      </p>
                    </div>

                    {isSelectionMode && (
                      <div className="flex gap-3 w-full pt-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleCancelSelection(); }}
                          className="flex-1 py-3 rounded-full font-semibold bg-white text-slate-500 hover:bg-slate-50 transition-all text-sm"
                        >
                          取消
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleGeneratePodcast(); }}
                          disabled={selectedWordIds.size === 0 || isLoading}
                          className={cn(
                            "flex-[2] py-3 rounded-full font-semibold transition-all flex items-center justify-center gap-2 text-sm",
                            selectedWordIds.size > 0 
                              ? "bg-blue-600 text-white" 
                              : "bg-slate-200 text-slate-400 cursor-not-allowed"
                          )}
                        >
                          {isLoading ? <RotateCcw className="animate-spin" size={14} /> : <Sparkles size={14} />}
                          确认生成
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Word List Area */}
                <div className="space-y-5">
                  {words.length === 0 ? (
                    <div className="bg-white rounded-3xl p-10 text-center text-slate-400 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                      <BookOpen size={40} className="mx-auto mb-4 opacity-20" />
                      <p className="text-sm font-bold">Your Archive is Waiting</p>
                      <p className="text-[10px] mt-1">Start adding words from chat or manual entry.</p>
                    </div>
                  ) : (
                    Object.entries(
                      [...words].sort((a, b) => b.createdAt - a.createdAt).reduce((acc, word) => {
                        const date = new Date(word.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
                        if (!acc[date]) acc[date] = [];
                        acc[date].push(word);
                        return acc;
                      }, {} as Record<string, Word[]>)
                    )
                    .map(([date, group]: [string, Word[]]) => {
                      const sortedGroup = [...group].sort((a, b) => b.createdAt - a.createdAt);
                      return (
                      <div key={date} className="space-y-3">
                        <div className="flex items-center gap-3 px-1">
                          <span className="text-xs font-semibold text-slate-400">{date}</span>
                          <div className="h-px bg-gray-100 flex-1" />
                        </div>

                        <div className="bg-white rounded-3xl overflow-hidden p-3 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-1">
                          {sortedGroup.map(w => (
                            <WordRow 
                              key={w.id} 
                              word={w} 
                              onPlay={() => speak(w.text)} 
                              selected={selectedWordIds.has(w.id)}
                              onSelect={() => toggleSelection(w.id)}
                              onDelete={() => handleDeleteWord(w.id)}
                              speak={speak}
                              onRefresh={() => handleRefreshWord(w.id, w.text)}
                              isSelectionMode={isSelectionMode}
                            />
                          ))}
                        </div>
                      </div>
                    );
                    })
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'book' && mode === 'flashcard' && (
              <FlashcardView 
                words={reviewQueue.length > 0 ? reviewQueue : words} 
                onResult={handleReviewComplete}
                onFinish={handleExitMode}
                speak={speak}
              />
            )}

            {activeTab === 'book' && mode === 'spelling' && (
              <SpellingBeeView 
                words={reviewQueue} 
                onResult={handleReviewComplete}
                onFinish={handleExitMode}
                speak={speak}
              />
            )}

            {activeTab === 'book' && mode === 'pronounce' && (
              <PronunciationChallengeView 
                words={reviewQueue} 
                onResult={handleReviewComplete}
                onFinish={handleExitMode}
                speak={speak}
              />
            )}

            {activeTab === 'book' && mode === 'podcast' && (
              <PodcastView
                data={podcastData}
                loading={isLoading}
                key="pod-view"
                onSpeak={speak}
                onStop={cancel}
                onFinish={handleExitMode}
                onRegenerate={handleRegeneratePodcast}
                onInspect={handleInspect}
                highlightWords={learningWords}
                isInspecting={isInspecting}
              />
            )}

            {activeTab === 'chat' && (
              <AnimatePresence mode="wait">
                {!selectedScenario ? (
                  <motion.div key="chat-root" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                    {/* Two Entry Cards — side by side */}
                    <div className="grid grid-cols-2 gap-3">
                      <div
                        onClick={() => setIsWordDialogueModalOpen(true)}
                        className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)] relative overflow-hidden cursor-pointer active:scale-[0.97] transition-all"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center">
                              <Lightbulb size={16} className="text-amber-600" />
                            </div>
                          </div>
                          <h2 className="text-base font-bold tracking-tight text-slate-900 leading-tight">生词本专项练习</h2>
                          <p className="text-slate-500 text-sm leading-relaxed line-clamp-2">选 1-5 个单词，AI 定制对话场景</p>
                        </div>
                      </div>

                      <div
                        onClick={() => { setIsAddingScenario(true); setScenarioMode('selection'); }}
                        className="bg-white rounded-3xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)] relative overflow-hidden cursor-pointer active:scale-[0.97] transition-all"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gray-100 rounded-3xl flex items-center justify-center">
                              <Plus size={16} className="text-gray-600" />
                            </div>
                          </div>
                          <h2 className="text-base font-bold tracking-tight text-slate-900 leading-tight">手动创建对话</h2>
                          <p className="text-slate-500 text-sm leading-relaxed line-clamp-2">自定义场景与角色，模拟真实对话</p>
                        </div>
                      </div>
                    </div>

                    {/* Categories and Grid */}
                    <div className="space-y-4">
                       <div className="space-y-3 pb-4">
                          <h3 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                            <Sparkles className="text-blue-600" size={18} />
                            推荐话题
                          </h3>
                          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                             {(() => {
                               const hasHistory = chatSessions.length > 0 || scenarios.some(s => !DEFAULT_SCENARIOS.some(ds => ds.id === s.id));
                               const cats = hasHistory
                                 ? ['History', 'Workplace', 'Shopping', 'Daily', 'Travel', 'Other']
                                 : ['Workplace', 'Shopping', 'Daily', 'Travel', 'Other'];
                               if (!hasHistory && selectedCategory === 'History') {
                                 setSelectedCategory('Workplace');
                               }
                               return cats.map(cat => (
                               <button
                                 key={cat}
                                 onClick={() => setSelectedCategory(cat)}
                                 className={cn(
                                   "px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all",
                                   selectedCategory === cat
                                     ? "bg-blue-600 text-white"
                                     : "bg-white text-slate-500 hover:bg-slate-50"
                                 )}
                               >
                                 {cat}
                               </button>
                             ));
                             })()}
                          </div>
                       </div>

                       <div className="grid grid-cols-2 gap-3">
                         {selectedCategory === 'History' ? (
                           (() => {
                             const customScenarios = scenarios.filter(s => !DEFAULT_SCENARIOS.some(ds => ds.id === s.id));
                             const allItems = [
                               ...chatSessions.map(s => ({ type: 'session' as const, data: s })),
                               ...customScenarios.map(s => ({ type: 'scenario' as const, data: s })),
                             ];
                             return allItems.length === 0 ? (
                               <div className="text-center py-10 text-slate-400 text-sm">暂无对话历史</div>
                             ) : (
                               allItems.map(({ type, data }) => (
                                 <HistoryCard
                                   key={data.id}
                                   type={type}
                                   data={data}
                                   onResume={resumeSession}
                                   onSelect={setSelectedScenario}
                                   onDeleteSession={(id) => {
                                     saveChatSessions(prev => prev.filter(s => s.id !== id));
                                     if (user) deleteDoc(doc(db, 'users', user.uid, 'chat_sessions', id)).catch(() => {});
                                   }}
                                   onDeleteScenario={(id) => {
                                     const nextCustom = scenarios.filter(s => !DEFAULT_SCENARIOS.some(ds => ds.id === s.id) && s.id !== id);
                                     setScenarios([...DEFAULT_SCENARIOS, ...nextCustom]);
                                   }}
                                 />
                               ))
                             );
                           })()
                         ) : (
                         [...scenarios]
                           .sort((a, b) => {
                             const aIsDefault = DEFAULT_SCENARIOS.some(ds => ds.id === a.id);
                             const bIsDefault = DEFAULT_SCENARIOS.some(ds => ds.id === b.id);
                             if (!aIsDefault && bIsDefault) return -1;
                             if (aIsDefault && !bIsDefault) return 1;
                             return 0;
                           })
                           .filter(s => s.category === selectedCategory)
                           .map(s => <ScenarioCard key={s.id} scenario={s} onClick={() => setSelectedScenario(s)} />)
                         )
                         }
                       </div>
                    </div>
                  </motion.div>
                ) : (
                  <ChatInterface scenario={selectedScenario} onBack={(msgs) => {
                    try {
                      if (msgs && msgs.length > 1) {
                        const session: ChatSession = {
                          id: `session-${selectedScenario.id}-${Date.now()}`,
                          scenarioId: selectedScenario.id,
                          title: selectedScenario.title,
                          messages: msgs,
                          targetWords: wordDialogueTargetWords.length > 0 ? wordDialogueTargetWords : undefined,
                          updatedAt: Date.now(),
                        };
                        saveChatSessions(prev => [session, ...prev.filter(s => s.scenarioId !== session.scenarioId)]);
                        if (user) {
                          const prevSessions = chatSessions;
                          setDoc(doc(db, 'users', user.uid, 'chat_sessions', session.id), { ...session, userId: user.uid }).catch(console.error);
                          // Delete old sessions for the same scenario
                          prevSessions.filter(s => s.scenarioId === session.scenarioId).forEach(s => {
                            deleteDoc(doc(db, 'users', user.uid, 'chat_sessions', s.id)).catch(() => {});
                          });
                        }
                      }
                    } catch (e) {
                      console.error('Failed to save chat session:', e);
                    }
                    setSelectedScenario(null);
                    setWordDialogueTargetWords([]);
                    setResumedMessages(null);
                  }} onAddWord={handleAddWord} targetWords={wordDialogueTargetWords.length > 0 ? wordDialogueTargetWords : undefined} initialMessages={resumedMessages || undefined} />
                )}
              </AnimatePresence>
            )}

            {activeTab === 'review' && (
              <motion.div key="review-root" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                {/* Stats Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => dueWords.length > 0 && setShowDueWords(true)}
                    className={cn(
                      "bg-white rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex items-center gap-4 group",
                      dueWords.length > 0 && "cursor-pointer hover:border-amber-300 active:scale-[0.98] transition-all"
                    )}
                  >
                    <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Clock size={24} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-slate-500 text-sm font-medium">待复习</p>
                      <h3 className="text-3xl font-bold tracking-tight mt-0.5">{dueWords.length} <span className="text-sm text-slate-400">词</span></h3>
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex items-center gap-4 group">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Award size={24} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-slate-500 text-sm font-medium">已掌握</p>
                      <h3 className="text-3xl font-bold tracking-tight mt-0.5">
                        {words.filter(w => w.masteryLevel >= 6).length}/{words.length}
                      </h3>
                    </div>
                  </div>
                </div>

                {/* Training Modes Grid */}
                <div className="grid grid-cols-1 gap-4">
                  <TrainingModule 
                      icon={<BookOpen size={32} />}
                      title="看中文回忆英文单词"
                      description="强化释义与单词的反射，适合记忆初期巩固。"
                      color="blue"
                      onClick={() => {
                        const targetWords = dueWords.length > 0 ? dueWords : [...words].sort(() => Math.random() - 0.5).slice(0, 10);
                        if (targetWords.length > 0) {
                          setReviewQueue(targetWords);
                          setReturnTab('review');
                          setMode('flashcard');
                          setActiveTab('book');
                        }
                      }}
                    />

                    <TrainingModule 
                      icon={<FileText size={32} />}
                      title="看中文拼写英文单词"
                      description="通过拼写纠错加强肌肉记忆，确保拼写绝对准确。"
                      color="amber"
                      onClick={() => {
                        if (words.length > 0) {
                          setReviewQueue([...words].sort(() => Math.random() - 0.5).slice(0, 10));
                          setReturnTab('review');
                          setMode('spelling');
                          setActiveTab('book');
                        }
                      }}
                    />

                    <TrainingModule 
                      icon={<Mic size={32} />}
                      title="看中文朗读对应读音"
                      description="AI 实时打分，矫正职场发音细节，提升口语自信。"
                      color="emerald"
                      onClick={() => {
                        const targetWords = dueWords.length > 0 ? dueWords : [...words].sort(() => Math.random() - 0.5).slice(0, 10);
                        if (targetWords.length > 0) {
                          setReviewQueue(targetWords);
                          setReturnTab('review');
                          setMode('pronounce');
                          setActiveTab('book');
                        }
                      }}
                    />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Word Dialogue Selection Modal */}
      <AnimatePresence>
        {isWordDialogueModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 lg:max-w-[600px] lg:mx-auto bg-black/30 backdrop-blur-xl z-[120] flex items-end justify-center"
            onClick={() => { setIsWordDialogueModalOpen(false); setWordDialogueSelected(new Set()); }}
          >
            <motion.div
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full bg-white rounded-t-3xl max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-5 border-b border-black/[0.04]">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold tracking-tight text-xl text-slate-900">选择练习单词</h3>
                  <button onClick={() => { setIsWordDialogueModalOpen(false); setWordDialogueSelected(new Set()); }} className="p-2 hover:bg-slate-100 rounded-xl">
                    <X size={18} />
                  </button>
                </div>
                <p className="text-blue-600 text-sm font-semibold">已选 {wordDialogueSelected.size}/5 个单词</p>
              </div>

              {/* Word List */}
              <div className="flex-1 overflow-y-auto max-h-[50vh] p-3">
                {words.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 text-sm">生词本暂无单词</div>
                ) : (
                  words.map(w => {
                    const isSelected = wordDialogueSelected.has(w.id);
                    const isFull = wordDialogueSelected.size >= 5 && !isSelected;
                    return (
                      <button
                        key={w.id}
                        onClick={() => !isFull && toggleWordDialogueSelection(w.id)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3.5 rounded-2xl transition-all mb-1",
                          isSelected ? "bg-blue-50" : isFull ? "opacity-30 cursor-not-allowed" : "hover:bg-slate-50"
                        )}
                      >
                        <div className={cn(
                          "w-6 h-6 rounded-3xl flex items-center justify-center shrink-0 transition-all",
                          isSelected ? "bg-blue-600 text-white" : "border-2 border-slate-200"
                        )}>
                          {isSelected && <Check size={14} />}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <span className="font-bold text-sm">{w.text}</span>
                          <span className="text-gray-300 text-xs ml-2">{w.pos}</span>
                          <p className="text-slate-500 text-sm truncate">{w.definition}</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Bottom Action */}
              <div className="p-5 border-t border-black/[0.04] flex gap-3">
                <button
                  onClick={() => { setIsWordDialogueModalOpen(false); setWordDialogueSelected(new Set()); }}
                  className="flex-1 py-3.5 rounded-full font-semibold text-sm text-slate-500 hover:bg-slate-50 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={handleStartWordDialogue}
                  disabled={wordDialogueSelected.size === 0}
                  className={cn(
                    "flex-1 py-3.5 rounded-full font-semibold text-sm transition-all",
                    wordDialogueSelected.size === 0
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.97]"
                  )}
                >
                  开始练习
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Due Words Bottom Sheet */}
      <AnimatePresence>
        {showDueWords && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 lg:max-w-[600px] lg:mx-auto bg-black/40 backdrop-blur-sm z-[120] flex items-end justify-center"
            onClick={() => setShowDueWords(false)}
          >
            <motion.div
              initial={{ y: 400 }}
              animate={{ y: 0 }}
              exit={{ y: 400 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full bg-white rounded-t-3xl max-h-[55vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-black/[0.04] flex items-center justify-between">
                <div>
                  <h3 className="font-bold tracking-tight text-xl text-slate-900">今日待复习</h3>
                  <p className="text-slate-500 text-sm mt-0.5">{dueWords.length} 个单词</p>
                </div>
                <button onClick={() => setShowDueWords(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {dueWords.map(w => (
                  <div key={w.id} className="flex items-center gap-3 p-3.5 rounded-2xl hover:bg-slate-50 transition-all">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-base text-slate-900">{w.text}</span>
                        {w.pos && <span className="text-blue-600 font-semibold text-xs bg-blue-50 px-2 py-0.5 rounded-full">{w.pos}</span>}
                      </div>
                      <p className="text-slate-500 text-sm truncate">{w.definition}</p>
                    </div>
                    <div className="shrink-0">
                      <div className={cn(
                        "w-8 h-8 rounded-3xl flex items-center justify-center text-xs font-semibold",
                        w.masteryLevel === 0 ? "bg-red-50 text-red-400" :
                        w.masteryLevel < 3 ? "bg-amber-50 text-amber-500" :
                        "bg-emerald-50 text-emerald-500"
                      )}>
                        Lv.{w.masteryLevel}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Word Modal */}
      <AnimatePresence>
        {isAddingWord && (
          <div className="fixed inset-0 lg:max-w-[600px] lg:mx-auto bg-black/30 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white w-full rounded-3xl p-6 relative shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <button onClick={() => { setIsAddingWord(false); setNewWordInput(''); setAddWordTab('text'); setBatchProgress(null); }} className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors"><X size={22} /></button>
              <h3 className="text-xl font-bold tracking-tight text-slate-900 mb-4">添加生词</h3>

              {/* Tab Switcher */}
              <div className="flex bg-slate-100 rounded-xl p-1 mb-4">
                {(['text', 'voice', 'image'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setAddWordTab(tab)}
                    className={cn(
                      'flex-1 py-2 rounded-3xl text-sm font-semibold transition-all',
                      addWordTab === tab ? 'bg-white shadow-sm text-slate-900' : 'text-gray-400'
                    )}
                  >
                    {tab === 'text' ? '文本' : tab === 'voice' ? '语音' : '图片'}
                  </button>
                ))}
              </div>

              {/* Text Tab */}
              {addWordTab === 'text' && (
                <textarea
                  autoFocus
                  value={newWordInput}
                  onChange={e => setNewWordInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200/60 rounded-2xl py-4 px-5 text-base font-semibold focus:ring-4 focus:ring-blue-100 resize-none min-h-[100px]"
                  placeholder="输入单词，多个单词用换行或逗号分隔"
                />
              )}

              {/* Voice Tab */}
              {addWordTab === 'voice' && (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <button
                      onClick={() => {
                        if (isListening) { cancel(); }
                        else { listen((text) => setNewWordInput(prev => prev ? prev + ', ' + text : text)); }
                      }}
                      className={cn(
                        'w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg',
                        isListening
                          ? 'bg-red-500 text-white shadow-red-200 animate-pulse'
                          : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.97]'
                      )}
                    >
                      <Mic size={32} />
                    </button>
                  </div>
                  <p className="text-center text-sm text-slate-500">
                    {isListening ? '正在聆听...' : '点击麦克风说出单词'}
                  </p>
                  {newWordInput && (
                    <textarea
                      value={newWordInput}
                      onChange={e => setNewWordInput(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200/60 rounded-2xl py-3 px-4 text-sm font-semibold focus:ring-4 focus:ring-blue-100 resize-none min-h-[60px]"
                      placeholder="识别结果（可编辑）"
                    />
                  )}
                </div>
              )}

              {/* Image Tab */}
              {addWordTab === 'image' && (
                <div className="space-y-3">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-2xl cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all">
                    <Upload size={24} className="text-slate-300 mb-2" />
                    <span className="text-sm text-slate-400 font-semibold">点击上传图片</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = e.target.files;
                        if (!files) return;
                        // For now, extract text from filename or prompt user
                        const names = Array.from(files).map(f => f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
                        setNewWordInput(prev => prev ? prev + '\n' + names.join('\n') : names.join('\n'));
                      }}
                    />
                  </label>
                  {newWordInput && (
                    <textarea
                      value={newWordInput}
                      onChange={e => setNewWordInput(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200/60 rounded-2xl py-3 px-4 text-sm font-semibold focus:ring-4 focus:ring-blue-100 resize-none min-h-[60px]"
                      placeholder="识别结果（可编辑）"
                    />
                  )}
                </div>
              )}

              {/* Progress Bar */}
              {batchProgress && (
                <div className="mt-4 space-y-2">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                      style={{ width: `${(batchProgress.done / batchProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-sm text-slate-500 text-center">
                    正在处理 {batchProgress.done}/{batchProgress.total} 个单词...
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <button
                disabled={isLoading || !newWordInput.trim() || !!batchProgress}
                onClick={() => {
                  const words = newWordInput.split(/[,，\n;；]+/).map(w => w.trim()).filter(Boolean);
                  if (words.length === 1) {
                    handleAddWord(words[0]);
                  } else {
                    handleBatchAdd(newWordInput);
                  }
                }}
                className={cn(
                  "w-full py-4 rounded-full mt-4 font-semibold flex items-center justify-center gap-3 transition-all",
                  (isLoading || !newWordInput.trim() || !!batchProgress)
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.97]"
                )}
              >
                {isLoading || batchProgress ? <div className="w-5 h-5 border-4 border-t-white rounded-full animate-spin" /> : "添加"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Scenario Modal */}
      <AnimatePresence>
        {isAddingScenario && (
          <div className="fixed inset-0 lg:max-w-[600px] lg:mx-auto bg-black/30 backdrop-blur-xl z-[150] flex items-center justify-center p-6">
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white w-full rounded-3xl p-6 relative shadow-[0_2px_12px_rgba(0,0,0,0.04)] max-h-[90vh] overflow-y-auto">
              <button onClick={() => { setIsAddingScenario(false); setScenarioMode('selection'); }} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"><X size={22} /></button>

              {scenarioMode === 'selection' && (
                <div className="space-y-5 py-2">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Plus size={24} />
                    </div>
                    <h3 className="text-xl font-bold tracking-tight text-slate-900 mb-1">Create Scenario</h3>
                    <p className="text-slate-500 text-sm">How do you want to define your simulation?</p>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <button onClick={() => setScenarioMode('manual')} className="p-4 rounded-2xl text-left hover:bg-blue-50 transition-all group shadow-[0_2px_12px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03]">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><FileText size={20} className="text-blue-600" /></div>
                      <h4 className="font-bold tracking-tight text-base text-slate-900 mb-0.5">Manual Entry</h4>
                      <p className="text-slate-500 text-sm">Type name, roles, and instructions yourself.</p>
                    </button>
                    
                    <button onClick={() => setScenarioMode('image')} className="p-4 rounded-2xl text-left hover:bg-emerald-50 transition-all group shadow-[0_2px_12px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03]">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><ImageIcon size={20} className="text-emerald-600" /></div>
                      <h4 className="font-bold text-sm mb-0.5">From Image</h4>
                      <p className="text-gray-400 text-[11px]">Upload a photo to extract context instantly.</p>
                    </button>
                  </div>
                </div>
              )}

              {scenarioMode === 'manual' && (
                <ScenarioForm onSave={saveScenario} onBack={() => setScenarioMode('selection')} />
              )}
              
              {scenarioMode === 'image' && (
                <ImageScenarioExtractor 
                  onExtracted={saveScenario} 
                  onBack={() => setScenarioMode('selection')} 
                  onLoading={setIsLoading} 
                />
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Inspector Modal */}
      <AnimatePresence>
        {inspectedWord && (
          <div 
            onClick={() => setInspectedWord(null)}
            className="fixed inset-0 lg:max-w-[600px] lg:mx-auto bg-black/30 backdrop-blur-xl z-[110] flex items-start justify-center p-6 overflow-y-auto pt-20"
          >
            <motion.div 
              onClick={(e) => e.stopPropagation()}
              initial={{ y: 20, opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: 20, opacity: 0 }} 
              className="bg-white w-full rounded-3xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] relative mb-12"
            >
              <button
                onClick={() => setInspectedWord(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors z-10"
              >
                <X size={22} />
              </button>
              
              <div className="mb-8">
                <div className="flex items-center gap-6 mb-2">
                  <h2 className="text-4xl font-bold">{inspectedWord.text}</h2>
                  <span className="text-blue-600 font-semibold bg-blue-50 px-2.5 py-1 rounded-full text-sm">{inspectedWord.details.pos}</span>
                  <button onClick={() => speak(inspectedWord.text)} className="p-3 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-100 transition-colors shadow-sm">
                    <Volume2 size={24} />
                  </button>
                </div>
                <div className="flex gap-6 text-gray-400 font-mono text-sm">
                  <button onClick={() => speak(inspectedWord.text, { accent: 'UK' })} className="flex items-center gap-2 hover:text-blue-600 transition-colors">
                    <span className="font-bold text-[10px] bg-gray-100 px-1 rounded text-gray-500">UK</span> 
                    {inspectedWord.details.ukPhonetic}
                    <Volume2 size={12} />
                  </button>
                  <button onClick={() => speak(inspectedWord.text, { accent: 'US' })} className="flex items-center gap-2 hover:text-blue-600 transition-colors">
                    <span className="font-bold text-[10px] bg-gray-100 px-1 rounded text-gray-500">US</span> 
                    {inspectedWord.details.usPhonetic}
                    <Volume2 size={12} />
                  </button>
                </div>
              </div>

              <div className="space-y-8">
                <section>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Definition</h4>
                  <p className="text-xl font-semibold text-slate-900 leading-relaxed">{inspectedWord.details.definition}</p>
                </section>

                {inspectedWord.details.collocations && inspectedWord.details.collocations.length > 0 && (
                  <section>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Collocations</h4>
                    <div className="flex flex-wrap gap-2">
                      {inspectedWord.details.collocations.map((c: any, i: number) => (
                        <div key={i} className="bg-slate-50 px-3 py-2.5 rounded-xl flex items-center gap-3 group/coll">
                          <div>
                            <span className="font-bold text-gray-700 text-xs block">{c.phrase}</span>
                            <span className="text-[10px] text-gray-400">{c.translation}</span>
                          </div>
                          <button onClick={() => speak(c.phrase)} className="text-gray-300 hover:text-blue-600 transition-colors">
                            <Volume2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Contextual Examples</h4>
                  <div className="space-y-4">
                    {inspectedWord.details.examples.map((ex: any, i: number) => (
                      <div key={i} className="bg-slate-50 p-4 rounded-2xl flex justify-between items-start group/ex">
                        <div className="flex-1">
                          <p className="font-bold text-gray-700 text-sm mb-1 italic">"{ex.sentence}"</p>
                          <p className="text-xs text-gray-400 font-medium">{ex.translation}</p>
                        </div>
                        <button onClick={() => speak(ex.sentence)} className="p-2 text-gray-300 hover:text-blue-600 transition-colors">
                          <Volume2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <button 
                  onClick={() => {
                    handleAddWord(inspectedWord.text);
                    setInspectedWord(null);
                  }}
                  disabled={words.some(w => w.text.toLowerCase() === inspectedWord.text.toLowerCase())}
                  className={cn(
                    "w-full py-4 rounded-full font-semibold transition-all flex items-center justify-center gap-3",
                    words.some(w => w.text.toLowerCase() === inspectedWord.text.toLowerCase())
                      ? "bg-emerald-50 text-emerald-600 cursor-default"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  )}
                >
                  {words.some(w => w.text.toLowerCase() === inspectedWord.text.toLowerCase()) ? (
                    <><Check size={20} /> ALREADY ARCHIVED</>
                  ) : (
                    <><Plus size={20} /> ADD TO MY LOOP</>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Loading Spinner */}
      <AnimatePresence>
        {isLoading && !isAddingWord && !inspectedWord && mode !== 'podcast' && (
          <div className="fixed bottom-10 right-10 z-[100] bg-white p-4 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex items-center gap-4">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold text-slate-500">Gemini is processing...</span>
          </div>
        )}
      </AnimatePresence>
      </div>{/* end phone container */}
    </div>
  );
}

function TrainingModule({ icon, title, description, color, onClick }: { icon: React.ReactNode, title: string, description: string, color: 'blue' | 'amber' | 'emerald', onClick: () => void }) {
  const colorMap = {
    blue: "group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-blue-200",
    amber: "group-hover:bg-amber-600 group-hover:text-white group-hover:shadow-amber-200",
    emerald: "group-hover:bg-emerald-600 group-hover:text-white group-hover:shadow-emerald-200"
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex items-center gap-4 cursor-pointer active:scale-[0.97] transition-all group"
    >
      <div className={cn("w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center transition-all shrink-0", colorMap[color])}>
        {icon}
      </div>
      <div className="min-w-0">
        <h4 className="text-base font-bold tracking-tight text-slate-900">{title}</h4>
        <p className="text-slate-500 text-sm leading-relaxed mt-1">{description}</p>
      </div>
    </div>
  );
}

function NavIcon({ icon, active, onClick, label }: { icon: React.ReactNode, active: boolean, onClick: () => void, label: string }) {
  return (
    <button onClick={onClick} className={cn("group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all", active ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-700")}>
      {icon}
      {active && <span className="lg:hidden absolute -top-1 left-1/2 -translate-x-1/2 w-5 h-1 bg-slate-900 rounded-b-full" />}
      <span className="sr-only">{label}</span>
    </button>
  );
}

function StatCard({ icon, title, value, color }: { icon: React.ReactNode, title: string, value: number, color: 'blue' | 'emerald' | 'amber' }) {
  const colors = {
    blue: "bg-blue-50 border-blue-100",
    emerald: "bg-emerald-50 border-emerald-100",
    amber: "bg-amber-50 border-amber-100"
  };
  return (
    <div className={cn("p-4 rounded-2xl border flex items-center gap-3 shadow-sm", colors[color])}>
      <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm">
        {icon}
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-1">{title}</p>
        <p className="text-2xl font-black">{value}</p>
      </div>
    </div>
  );
}

function ScenarioForm({ onSave, onBack }: { onSave: (s: Scenario) => void, onBack: () => void }) {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [category, setCategory] = useState<Scenario['category']>('Workplace');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleCreate = async () => {
    if (!systemPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const res = await getGeminiResponse(
        `Based on this conversation scenario instruction, generate a short title (max 8 words) and a one-sentence description. Return JSON only: {"title": "...", "description": "..."}` ,
        systemPrompt
      );
      let title = 'Custom Dialogue';
      let description = systemPrompt.slice(0, 60) + '...';
      if (res) {
        try {
          const parsed = JSON.parse(res);
          if (parsed.title) title = parsed.title;
          if (parsed.description) description = parsed.description;
        } catch {}
      }
      onSave({
        id: Date.now().toString(),
        title,
        description,
        systemPrompt,
        category,
        initialMessage: `Let's start! I'm ready for this conversation about ${title.toLowerCase()}.`,
      });
    } catch {
      onSave({
        id: Date.now().toString(),
        title: 'Custom Dialogue',
        description: systemPrompt.slice(0, 60) + '...',
        systemPrompt,
        category,
        initialMessage: "Let's start our conversation!",
      });
    }
    setIsGenerating(false);
  };

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-slate-900">手动创建对话</h3>
          <p className="text-slate-500 text-sm">描述你想要的对话场景，AI 自动生成标题</p>
        </div>
        <button onClick={onBack} className="text-slate-500 hover:text-slate-900 font-semibold text-sm">取消</button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest text-slate-400 block mb-2">对话场景</label>
          <textarea
            autoFocus
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200/60 rounded-2xl p-4 font-medium outline-none min-h-[140px] focus:ring-4 focus:ring-blue-100 transition-all"
            placeholder="描述对话场景，例如：你是一个严格的面试官，我是一名应聘者，正在进行产品经理岗位的终面..."
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest text-slate-400 block mb-2">分类</label>
          <div className="flex gap-2">
            {(['Workplace', 'Daily', 'Travel', 'Shopping', 'Other'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  "px-3 py-2 rounded-full text-sm font-semibold transition-all",
                  category === cat
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-400 hover:bg-slate-50"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={handleCreate}
        disabled={!systemPrompt.trim() || isGenerating}
        className={cn(
          "w-full py-4 rounded-full font-semibold text-sm transition-all",
          (!systemPrompt.trim() || isGenerating)
            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
            : "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.97]"
        )}
      >
        {isGenerating ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-t-white rounded-full animate-spin" />
            AI 生成中...
          </span>
        ) : "创建对话"}
      </button>
    </div>
  );
}

function ImageScenarioExtractor({ onExtracted, onBack, onLoading }: { onExtracted: (s: Scenario) => void, onBack: () => void, onLoading: (l: boolean) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleGenerate = async () => {
    if (!extractedText.trim()) return;
    setIsGenerating(true);
    onLoading(true);
    try {
      const result = await parseScenarioFromImage(extractedText);
      if (result) {
        onExtracted({ ...result, id: Date.now().toString(), extractedText: extractedText.trim() });
      }
    } finally {
      setIsGenerating(false);
      onLoading(false);
    }
  };

  return (
    <div className="space-y-5 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-slate-900 mb-1">从图片创建对话</h3>
          <p className="text-slate-500 text-sm">上传图片，输入其中的文本内容，AI 自动生成对话</p>
        </div>
        <button onClick={onBack} className="text-slate-500 hover:text-slate-900 font-semibold text-sm">取消</button>
      </div>

      {/* Image upload area */}
      {!previewUrl ? (
        <div className="border-2 border-dashed border-slate-300 rounded-2xl p-10 hover:border-blue-300 hover:bg-blue-50/20 transition-all group flex flex-col items-center justify-center cursor-pointer" onClick={() => fileRef.current?.click()}>
          <input type="file" ref={fileRef} hidden accept="image/*" onChange={handleFile} />
          <Upload size={32} className="text-slate-300 group-hover:text-blue-500 transition-colors mb-2" />
          <p className="text-slate-400 text-sm font-semibold group-hover:text-blue-600">点击上传图片</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative rounded-2xl overflow-hidden bg-slate-100">
            <img src={previewUrl} alt="预览" className="w-full max-h-48 object-contain" />
            <button
              onClick={() => { setPreviewUrl(null); setExtractedText(''); }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-400 block mb-2">图片中的文本内容</label>
            <textarea
              autoFocus
              value={extractedText}
              onChange={e => setExtractedText(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/60 rounded-2xl p-4 font-medium outline-none min-h-[120px] focus:ring-4 focus:ring-blue-100 transition-all"
              placeholder="输入图片中的英文文本内容..."
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={!extractedText.trim() || isGenerating}
            className={cn(
              "w-full py-4 rounded-full font-semibold text-sm transition-all",
              (!extractedText.trim() || isGenerating)
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.97]"
            )}
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-t-white rounded-full animate-spin" />
                AI 生成中...
              </span>
            ) : "生成对话场景"}
          </button>
        </div>
      )}
    </div>
  );
}

const WordRow: React.FC<{
  word: Word,
  onPlay: () => void,
  selected: boolean,
  onSelect: () => void,
  onDelete: () => void,
  speak: (t: string) => void,
  onRefresh?: () => void,
  isSelectionMode?: boolean
}> = ({ word, onPlay, selected, onSelect, onDelete, speak, onRefresh, isSelectionMode }) => {
  const [expanded, setExpanded] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);
  const isSwiping = useRef(false);

  const hasMissingData = !word.ukPhonetic || !word.collocations || word.collocations.length === 0;
  const DELETE_THRESHOLD = 80;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchCurrentX.current = e.touches[0].clientX;
    isSwiping.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = touchStartX.current - e.touches[0].clientX;
    const dy = touchStartY.current - e.touches[0].clientY;
    if (!isSwiping.current && Math.abs(dy) > Math.abs(dx)) return;
    if (Math.abs(dx) > 10) isSwiping.current = true;
    touchCurrentX.current = e.touches[0].clientX;
    if (dx > 0) {
      setSwipeX(Math.min(dx, 160));
    } else {
      setSwipeX(0);
    }
  };

  const handleTouchEnd = () => {
    if (isSwiping.current) {
      const diff = touchStartX.current - touchCurrentX.current;
      if (diff > DELETE_THRESHOLD) {
        onDelete();
      }
    }
    setSwipeX(0);
    isSwiping.current = false;
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Delete button behind the row */}
      <div className="absolute inset-y-0 right-0 w-20 flex items-center justify-center bg-red-50">
        <Trash2 size={20} className="text-red-400" />
      </div>

      {/* Main content — slides left on swipe */}
      <div
        style={{ transform: `translateX(${-swipeX}px)`, transition: swipeX === 0 ? 'transform 0.2s ease' : 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={cn("relative p-4 transition-colors group bg-white", expanded ? "bg-slate-50 my-2 shadow-[0_2px_12px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03]" : "hover:bg-slate-50")}
      >
        <div className="flex items-center gap-4">
          {isSelectionMode && (
            <button onClick={onSelect} className={cn("transition-all h-8 w-8 rounded-xl flex items-center justify-center", selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-300 hover:text-slate-400")}>
              {selected ? <Check size={18} /> : <Square size={18} />}
            </button>
          )}
          <div className="flex-1 cursor-pointer" onClick={isSelectionMode ? onSelect : () => setExpanded(!expanded)}>
            <div className="flex items-center gap-4 flex-wrap">
              <h4 className="font-bold text-xl text-slate-900">{word.text}</h4>
              {word.pos && <span className="text-blue-600 font-semibold text-xs bg-blue-50 px-2 py-0.5 rounded-full">{word.pos}</span>}

              <div className="flex gap-4 text-slate-400 font-mono text-xs items-center">
                <button
                  onClick={(e) => { e.stopPropagation(); speak(word.text, { accent: 'UK' }); }}
                  className={cn("flex items-center gap-1.5 transition-colors", word.ukPhonetic ? "hover:text-blue-600" : "opacity-30")}
                >
                  <span className="font-semibold bg-slate-100 px-1.5 rounded text-[10px] text-slate-500 uppercase">UK</span>
                  {word.ukPhonetic || "---"}
                  <Volume2 size={12} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); speak(word.text, { accent: 'US' }); }}
                  className={cn("flex items-center gap-1.5 transition-colors", word.usPhonetic ? "hover:text-blue-600" : "opacity-30")}
                >
                  <span className="font-semibold bg-slate-100 px-1.5 rounded text-[10px] text-slate-500 uppercase">US</span>
                  {word.usPhonetic || "---"}
                  <Volume2 size={12} />
                </button>
              </div>

              {hasMissingData && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRefresh?.(); }}
                  className="text-[10px] font-semibold text-amber-500 bg-amber-50 px-2 py-1 rounded-3xl flex items-center gap-1 hover:bg-amber-100 transition-all ml-auto md:ml-0"
                >
                  <RotateCcw size={10} /> Data Incomplete - Sync?
                </button>
              )}
            </div>
            {!expanded && <p className="text-slate-500 text-sm mt-1">{word.definition}</p>}
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <button onClick={onDelete} className="p-2.5 rounded-xl text-slate-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100">
              <Trash2 size={18} />
            </button>
            <button onClick={onPlay} className="p-2.5 rounded-xl text-slate-300 hover:text-blue-600 transition-all">
              <Volume2 size={18} />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-6 pt-6 border-t border-black/[0.04] space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Definition</h5>
                  <button onClick={() => speak(word.definition)} className="text-gray-300 hover:text-blue-600 transition-colors"><Volume2 size={14} /></button>
                </div>
                <p className="text-slate-900 font-bold text-2xl leading-tight">{word.definition}</p>
              </div>

              <div className="space-y-4">
                <h5 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Common Collocations</h5>
                {word.collocations && word.collocations.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {word.collocations.map((c, i) => (
                      <div key={i} className="bg-white px-4 py-3 rounded-xl flex items-center gap-4 hover:bg-blue-50/50 transition-all group/coll shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                        <div>
                          <span className="font-semibold text-slate-800 text-sm block">{c.phrase}</span>
                          <span className="text-xs text-slate-400">{c.translation}</span>
                        </div>
                        <button onClick={() => speak(c.phrase)} className="text-slate-300 group-hover/coll:text-blue-500 transition-colors">
                          <Volume2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl text-center bg-slate-50">
                    <p className="text-slate-400 text-sm">No collocation data found for this entry.</p>
                    <button onClick={onRefresh} className="mt-2 text-sm font-semibold text-blue-600 hover:underline">Re-run AI Analysis</button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h5 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Contextual Examples</h5>
                <div className="space-y-4">
                  {word.examples.map((ex, i) => (
                    <div key={i} className="bg-slate-50 p-4 rounded-xl flex justify-between items-start hover:bg-blue-50/50 transition-all group/ex">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-800 text-base mb-2 italic leading-relaxed">"{ex.sentence}"</p>
                        <p className="text-sm text-slate-400">{ex.translation}</p>
                      </div>
                      <button onClick={() => speak(ex.sentence)} className="p-3 text-slate-300 group-hover/ex:text-blue-500 transition-colors">
                        <Volume2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const ScenarioCard: React.FC<{ scenario: Scenario, onClick: () => void }> = ({ scenario, onClick }) => {
  const isCustom = !DEFAULT_SCENARIOS.some(ds => ds.id === scenario.id);
  const Icon = scenario.category === 'Workplace' ? Briefcase : scenario.category === 'Shopping' ? ShoppingBag : scenario.category === 'Travel' ? Plane : scenario.category === 'Daily' ? Coffee : MessageSquare;
  const colorClass = scenario.category === 'Workplace' ? 'text-blue-600 bg-blue-50' : scenario.category === 'Shopping' ? 'text-emerald-600 bg-emerald-50' : scenario.category === 'Travel' ? 'text-amber-600 bg-amber-50' : 'text-gray-600 bg-gray-50';

  return (
    <button onClick={onClick} className="bg-white p-3.5 rounded-2xl text-left hover:shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition-all group overflow-hidden flex flex-col h-full shadow-[0_2px_12px_rgba(0,0,0,0.04)] relative">
      {isCustom && (
        <div className="absolute top-2 right-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold rounded-full">
          Manual
        </div>
      )}
      <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center mb-2 transition-all group-hover:scale-110", colorClass)}>
        <Icon size={16} />
      </div>
      <h3 className="text-sm font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">{scenario.title}</h3>
      <p className="text-slate-500 text-xs leading-relaxed line-clamp-2 mt-1">{scenario.description}</p>
    </button>
  );
};

const HistoryCard: React.FC<{
  type: 'session' | 'scenario';
  data: ChatSession | Scenario;
  onResume: (s: ChatSession) => void;
  onSelect: (s: Scenario) => void;
  onDeleteSession: (id: string) => void;
  onDeleteScenario: (id: string) => void;
}> = ({ type, data, onResume, onSelect, onDeleteSession, onDeleteScenario }) => {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  return (
    <div
      onClick={() => {
        if (longPressTriggered.current) { longPressTriggered.current = false; return; }
        type === 'session' ? onResume(data as ChatSession) : onSelect(data as Scenario);
      }}
      onTouchStart={() => {
        longPressTriggered.current = false;
        longPressTimer.current = setTimeout(() => {
          longPressTriggered.current = true;
          if (confirm('确定删除这条对话记录吗？')) {
            type === 'session' ? onDeleteSession(data.id) : onDeleteScenario(data.id);
          }
        }, 600);
      }}
      onTouchEnd={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
      onTouchMove={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
      className="bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)] cursor-pointer hover:shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition-all active:bg-slate-50 select-none"
    >
      <h4 className="font-bold tracking-tight text-base text-slate-900">{data.title}</h4>
      {type === 'session' ? (
        <>
          <p className="text-gray-400 text-[10px] mt-1">
            {(data as ChatSession).messages.length} 条消息 · {new Date((data as ChatSession).updatedAt).toLocaleDateString('zh-CN')}
          </p>
          {(data as ChatSession).targetWords && (data as ChatSession).targetWords!.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {(data as ChatSession).targetWords!.map(w => (
                <span key={w} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-semibold rounded-full">{w}</span>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-slate-500 text-sm mt-1">{(data as Scenario).description}</p>
      )}
    </div>
  );
};

function ChatInterface({ scenario, onBack, onAddWord, targetWords, initialMessages }: { scenario: Scenario, onBack: (messages: ChatMessage[]) => void, onAddWord: (t: string) => void, targetWords?: string[], initialMessages?: ChatMessage[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const { listen, isListening, speak, cancel } = useSpeech();

  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
    } else {
      setMessages([{ role: 'model', text: scenario.initialMessage }]);
      const timer = setTimeout(() => {
        speak(scenario.initialMessage);
        listen(setInputText);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [scenario]);

  const handleSend = async (t?: string) => {
    const txt = t || inputText;
    if (!txt) return;
    setMessages(prev => [...prev, { role: 'user', text: txt }]);
    setInputText('');
    setSuggestion(null);
    
    const extractedContext = scenario.extractedText ? `\n\nReference text from image:\n"""\n${scenario.extractedText}\n"""\nPlease base the conversation on this text's topic and vocabulary.` : '';
    const prompt = `Current Context: ${scenario.title}${extractedContext}\nUser just said: "${txt}"\nIf the user input is partially Chinese or unclear, first provide the correct/professional English version. Then continue the roleplay naturally.`;
    const res = await getGeminiResponse(prompt, scenario.systemPrompt + "\nIf the user is struggling, suggest 2-3 advanced words/phrases they could have used.");
    
    if (res && res.includes('"')) {
       const match = res.match(/"([^"]+)"/);
       if (match) setSuggestion(match[1]);
    }

    if (res) {
      setMessages(prev => [...prev, { role: 'model', text: res }]);
      speak(res);
      // The core change: automatically listen again after AI speaks
      // We wait a bit for the speech to finish (approximate)
      setTimeout(() => {
        listen(setInputText);
      }, 1000); 
    }
  };

  const toggleListen = () => {
    if (isListening) {
      handleSend();
    } else {
      listen(setInputText);
    }
  };

  return (
    <div className="h-[80vh] lg:h-[500px] flex flex-col bg-white rounded-3xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.04)] relative">
      <div className="p-4 md:p-6 border-b border-black/[0.04] flex items-center justify-between">
        <button onClick={() => { cancel(); onBack(messages); }} className="p-2 hover:bg-gray-100 rounded-xl"><ChevronLeft size={24} /></button>
        <div className="flex flex-col items-center">
          <h3 className="font-bold tracking-tight text-base md:text-lg line-clamp-1 text-slate-900">{scenario.title}</h3>
          <span className="text-xs font-medium text-slate-500 tracking-wide leading-none">Fluid Exchange</span>
        </div>
        <div className="w-10" />
      </div>

      {scenario.extractedText && (
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-100/50">
          <p className="text-xs font-semibold text-amber-600 mb-1 flex items-center gap-1"><FileText size={12} /> 图片文本</p>
          <p className="text-sm text-amber-900 leading-relaxed whitespace-pre-wrap break-words">{scenario.extractedText}</p>
        </div>
      )}

      {targetWords && targetWords.length > 0 && (
        <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100/50 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <Target size={12} className="text-blue-500 shrink-0" />
          {targetWords.map(w => (
            <span key={w} className="px-2.5 py-1 bg-white text-blue-700 text-xs font-semibold rounded-full whitespace-nowrap shadow-sm">{w}</span>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8" pb-40>
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === 'user' ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] p-3 rounded-xl relative group text-sm", m.role === 'user' ? "bg-gray-900 text-white rounded-tr-none" : "bg-gray-100 rounded-tl-none")}>
              <p className="leading-relaxed">{m.text}</p>
              {m.role === 'model' && (
                <button 
                  onClick={() => speak(m.text)}
                  className="absolute -right-10 top-0 p-2 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-blue-600 transition-all"
                >
                  <Volume2 size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {suggestion && (
          <motion.div initial={{ y: 20 }} animate={{ y: 0 }} className="px-8 pb-4">
             <div className="bg-blue-50 p-3.5 rounded-xl flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <Sparkles size={16} className="text-blue-600" />
                 <span className="text-sm font-bold text-blue-900">Recommended Phrase: <span className="italic">{suggestion}</span></span>
               </div>
               <button onClick={() => onAddWord(suggestion)} className="text-[10px] font-extrabold uppercase bg-blue-600 text-white px-3 py-1.5 rounded-3xl flex items-center gap-2">
                 <Plus size={14} /> ADD TO ARCHIVE
               </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-[72px] left-0 right-0 p-4 md:p-6 border-t border-black/[0.04] bg-white/90 backdrop-blur-md z-40">
        <div className="flex gap-2 md:gap-4">
          <div className="flex-1 relative">
            <input 
              value={inputText} 
              onChange={e => setInputText(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleSend()} 
              placeholder={isListening ? "Listening..." : "Message..."}
              className={cn("w-full py-4 px-5 md:px-6 rounded-2xl font-bold transition-all shadow-inner border border-transparent focus:bg-white outline-none text-sm md:text-base", isListening ? "bg-red-50 border-red-100" : "bg-gray-50")} 
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
              {isListening && (
                <motion.div 
                  animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0.2, 0.5] }} 
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="absolute inset-0 bg-red-400 rounded-full -z-10"
                />
              )}
              <button 
                onClick={toggleListen} 
                className={cn(
                  "p-2 rounded-xl transition-all", 
                  isListening ? "bg-red-600 text-white shadow-lg shadow-red-100" : "text-gray-300 hover:text-gray-600"
                )}
              >
                <Mic size={20} />
              </button>
            </div>
          </div>
          <button onClick={() => handleSend()} className="bg-blue-600 text-white font-semibold px-6 md:px-8 rounded-full hover:bg-blue-700 transition-all flex items-center justify-center">
            <span className="hidden md:inline">SEND</span>
            <ChevronRight size={20} className="md:hidden" />
          </button>
        </div>
      </div>
    </div>
  );
}

function FlashcardView({ words, onResult, onFinish, speak }: { words: Word[], onResult: (id: string, success: boolean) => void, onFinish: () => void, speak: (t: string) => void }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const current = words[index];

  if (words.length === 0) return <div className="text-center py-20 text-gray-400">No tokens to review.</div>;

  const handleAction = (success: boolean) => {
    onResult(current.id, success);
    if (index < words.length - 1) {
      setIndex(index + 1);
      setFlipped(false);
    } else {
      onFinish();
    }
  };

  return (
    <div className="max-w-md mx-auto py-10 space-y-8">
      <div className="flex justify-between items-center text-sm font-semibold text-slate-400 px-4">
        <span>Token {index + 1} of {words.length}</span>
        <button onClick={onFinish} className="hover:text-slate-900">EXIT</button>
      </div>
      
      <div className="relative h-96 perspective-1000 group cursor-pointer" onClick={() => { setFlipped(!flipped); if(!flipped) speak(current.text); }}>
        <motion.div 
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
          className="w-full h-full relative preserve-3d"
        >
          {/* Front */}
          <div className="absolute inset-0 backface-hidden bg-white rounded-3xl flex flex-col items-center justify-center p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
              <Volume2 size={24} />
            </div>
            <h2 className="text-2xl font-extrabold mb-2">{current.text}</h2>
            <p className="text-gray-400 font-mono text-xs italic">{current.ukPhonetic}</p>
            <p className="mt-4 text-[10px] font-bold text-blue-400 animate-pulse">TAP TO FLIP</p>
          </div>
          {/* Back */}
          <div className="absolute inset-0 backface-hidden bg-gray-900 border-2 border-gray-900 rounded-2xl flex flex-col items-center justify-center p-6 text-white transform rotateY-180">
            <p className="text-lg font-bold mb-4 text-center">{current.definition}</p>
            <div className="space-y-4 w-full">
              {current.examples.slice(0, 1).map((ex, i) => (
                <div key={i} className="text-center">
                  <p className="text-sm text-gray-300 italic mb-1">"{ex.sentence}"</p>
                  <p className="text-xs text-gray-500">{ex.translation}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 grid grid-cols-2 gap-4 w-full">
              <button 
                onClick={(e) => { e.stopPropagation(); handleAction(false); }}
                className="py-4 bg-white/10 hover:bg-white/20 rounded-full font-semibold text-sm transition-colors"
              >
                FORGOT
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); handleAction(true); }}
                className="py-4 bg-blue-600 hover:bg-blue-700 rounded-full font-semibold text-sm transition-colors"
              >
                MASTERED
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="flex justify-center text-gray-300">
        <Sparkles size={24} className="animate-pulse" />
      </div>
    </div>
  );
}

function PronunciationChallengeView({ 
  words, 
  onResult, 
  onFinish, 
  speak
}: { 
  words: Word[], 
  onResult: (id: string, success: boolean) => void,
  onFinish: () => void,
  speak: (t: string) => void
}) {
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<'idle' | 'recording' | 'correct' | 'wrong'>('idle');
  const [transcript, setTranscript] = useState('');
  const { listen, isListening } = useSpeech();
  
  const current = words[index];

  const handleListen = () => {
    setStatus('recording');
    listen((text) => {
      setTranscript(text);
      const cleanedInput = text.toLowerCase().trim().replace(/[^\w]/g, '');
      const cleanedTarget = current.text.toLowerCase().trim().replace(/[^\w]/g, '');
      
      if (cleanedInput === cleanedTarget) {
        setStatus('correct');
        onResult(current.id, true);
        setTimeout(() => {
          if (index < words.length - 1) {
            setIndex(item => item + 1);
            setStatus('idle');
            setTranscript('');
          } else {
            onFinish();
          }
        }, 1500);
      } else {
        setStatus('wrong');
        onResult(current.id, false);
      }
    });
  };

  if (!current) return null;

  return (
    <div className="w-full mx-auto py-6">
      <div className="bg-white rounded-3xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-6 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-100">
          <motion.div
            className="h-full bg-emerald-500"
            initial={{ width: 0 }}
            animate={{ width: `${((index + 1) / words.length) * 100}%` }}
          />
        </div>

        <div className="space-y-1 pt-2">
          <span className="text-sm font-medium text-slate-500">Pronunciation Challenge</span>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 leading-tight">请读出该单词的英文</h2>
        </div>

        <div className="py-8 px-6 bg-slate-50 rounded-2xl">
           <p className="text-2xl font-bold text-slate-900">{current.definition}</p>
        </div>

        <div className="flex flex-col items-center gap-6">
          <button 
            disabled={isListening || status === 'correct'}
            onClick={handleListen}
            className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center transition-all active:scale-95 group relative",
              isListening ? "bg-red-500 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
            )}
          >
            {isListening && (
              <motion.div 
                animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="absolute inset-0 bg-red-400 rounded-full"
              />
            )}
            <Mic size={40} className="relative z-10" />
          </button>
          
          <p className="text-sm font-medium text-slate-500">
            {isListening ? "正在开启麦克风..." : "点击开始录音"}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {status === 'correct' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-emerald-500 font-bold flex items-center justify-center gap-2">
              <CheckCircle size={20} /> Excellent!
            </motion.div>
          )}
          {status === 'wrong' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="text-red-500 font-bold flex items-center justify-center gap-2">
                <XCircle size={20} /> Try again
              </div>
              <div className="p-4 bg-red-50 rounded-2xl italic text-red-800 text-sm">
                "{transcript}"
              </div>
              <div className="flex flex-col items-center gap-2">
                 <p className="text-sm text-slate-500 font-semibold">Target Word</p>
                 <div className="flex items-center gap-3">
                    <span className="text-2xl font-black">{current.text}</span>
                    <button onClick={() => speak(current.text)} className="p-2 bg-white rounded-xl text-slate-400 hover:text-blue-600 transition-all">
                       <Volume2 size={16} />
                    </button>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pt-6 border-t border-black/[0.04] flex items-center justify-between">
           <span className="text-sm font-medium text-slate-400">Progress: {index + 1} / {words.length}</span>
           <button onClick={onFinish} className="text-sm font-medium text-slate-400 hover:text-slate-900">Exit</button>
        </div>
      </div>
    </div>
  );
}

function SpellingBeeView({ words, onResult, onFinish, speak }: { words: Word[], onResult: (id: string, success: boolean) => void, onFinish: () => void, speak: (t: string) => void }) {
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'wrong' | 'correct'>('idle');
  const current = words[index];

  useEffect(() => {
    if (current) speak(current.text);
  }, [index, current]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.toLowerCase().trim() === current.text.toLowerCase().trim()) {
      setStatus('correct');
      onResult(current.id, true);
      setTimeout(() => {
        if (index < words.length - 1) {
          setIndex(index + 1);
          setInput('');
          setStatus('idle');
        } else {
          onFinish();
        }
      }, 800);
    } else {
      setStatus('wrong');
      onResult(current.id, false);
      speak(current.text);
      setTimeout(() => setStatus('idle'), 1000);
    }
  };

  if (words.length === 0) return null;

  return (
    <div className="w-full mx-auto py-6">
      <div className="bg-white rounded-3xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-6 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-100">
          <motion.div
            className="h-full bg-emerald-500"
            initial={{ width: 0 }}
            animate={{ width: `${(index / words.length) * 100}%` }}
          />
        </div>

        <div className="flex justify-center">
          <button 
            onClick={() => speak(current.text)}
            className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
          >
            <Volume2 size={40} />
          </button>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-medium text-slate-500">Definition</h2>
          <p className="text-2xl font-bold text-slate-900">{current.definition}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <input 
            autoFocus
            value={input}
            onChange={e => setInput(e.target.value)}
            className={cn(
              "w-full bg-slate-50 border-2 rounded-full p-6 text-center text-2xl font-bold outline-none transition-all",
              status === 'correct' ? "border-blue-600 bg-blue-50 text-blue-600" : 
              status === 'wrong' ? "border-red-500 bg-red-50 text-red-600 animate-shake" : 
              "border-gray-100 focus:border-blue-400 focus:bg-white"
            )}
            placeholder="Type what you hear..."
          />
          <div className="flex items-center justify-between text-sm font-medium text-slate-400 px-4">
            <span>Progress: {index + 1} / {words.length}</span>
            <button type="button" onClick={onFinish} className="hover:text-slate-900">GIVE UP</button>
          </div>
        </form>

        <AnimatePresence>
          {status === 'wrong' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0 }}
              className="pt-4 border-t border-black/[0.04]"
            >
              <p className="text-red-500 text-sm font-semibold mb-1">Correct Answer:</p>
              <p className="text-2xl font-black text-red-600">{current.text}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

