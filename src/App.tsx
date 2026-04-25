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
  FileText,
  Sparkles,
  Check,
  CheckSquare,
  Square,
  Ear,
  Trash2,
  Languages,
  Image as ImageIcon,
  Upload,
  FileText as FileTextIcon,
  RotateCcw,
  Briefcase,
  ShoppingBag,
  Plane,
  Coffee,
  CheckCircle,
  XCircle,
  LogIn,
  LogOut,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Word, Scenario, ChatMessage } from './types';
import { getGeminiResponse, generateWordDetails, generatePodcastDialogue, parseScenarioFromImage } from './lib/gemini';
import { useSpeech } from './hooks/useSpeech';
import { useAuth } from './components/AuthProvider';
import { auth, db, googleProvider, collections, handleFirestoreError } from './lib/firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import { 
  getDocs, 
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
alert("这是最新部署的版本!");

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
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isAddingWord, setIsAddingWord] = useState(false);
  const [isAddingScenario, setIsAddingScenario] = useState(false);
  const [scenarioMode, setScenarioMode] = useState<'selection' | 'manual' | 'image'>('selection');
  const [newWordInput, setNewWordInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [returnTab, setReturnTab] = useState<'book' | 'review'>('book');
  const [mode, setMode] = useState<'normal' | 'flashcard' | 'podcast' | 'spelling' | 'pronounce'>('normal');
  const [podcastData, setPodcastData] = useState<{ english: string, chinese: string } | null>(null);
  const [inspectedWord, setInspectedWord] = useState<{ text: string, details: any } | null>(null);
  const [reviewQueue, setReviewQueue] = useState<Word[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
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
        await updateDoc(doc(db, 'words', wordId), {
          masteryLevel: nextLevel,
          lastReviewedAt: Date.now()
        });
      } catch (e) {
        handleFirestoreError(e, 'update_mastery', `words/${wordId}`);
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

  // Logic to generate podcast
  const handleGeneratePodcast = async () => {
    const targetWords = words.filter(w => selectedWordIds.has(w.id)).map(w => w.text);
    if (targetWords.length === 0) return;
    setLearningWords(targetWords);
    setIsLoading(true);
    setReturnTab('book');
    setMode('podcast');
    const data = await generatePodcastDialogue(targetWords);
    if (data) setPodcastData(data);
    setIsLoading(false);
    setIsSelectionMode(false); 
    setSelectedWordIds(new Set()); 
  };

  const handleStartSelection = () => {
    setIsSelectionMode(true);
    setSelectedWordIds(new Set());
  };

  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedWordIds(new Set());
  };

  useEffect(() => {
    const loadData = async () => {
      if (user) {
        setIsLoading(true);
        try {
          // Load Words
          const wordsQuery = query(collections.words, where('userId', '==', user.uid));
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
                const wordRef = doc(db, 'words', lw.id);
                batch.set(wordRef, wordWithUser);
                merged.push(wordWithUser);
                migrationCount++;
              }
            });

            if (migrationCount > 0) {
              await batch.commit();
              localStorage.removeItem('lexiloop_words');
            }
            setWords(merged);
          } else {
            setWords(cloudWords);
          }

          // Load Scenarios
          const scenariosQuery = query(collections.scenarios, where('userId', '==', user.uid));
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

        } catch (e) {
          console.error("Error loading user data:", e);
        } finally {
          setIsLoading(false);
        }
      } else {
        // Fallback to local
        const stored = localStorage.getItem('lexiloop_words');
        if (stored) setWords(JSON.parse(stored));
        
        const storedScenarios = localStorage.getItem('lexiloop_scenarios');
        if (storedScenarios) {
          setScenarios([...DEFAULT_SCENARIOS, ...JSON.parse(storedScenarios)]);
        }
      }
    };

    loadData();
  }, [user]);

  const saveWords = async (newWords: Word[]) => {
    setWords(newWords);
    if (!user) {
      localStorage.setItem('lexiloop_words', JSON.stringify(newWords));
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
        handleFirestoreError(e, 'save_scenario', `scenarios/${newScenario.id}`);
      }
    } else {
      localStorage.setItem('lexiloop_scenarios', JSON.stringify(nextCustom));
    }
    
    setIsAddingScenario(false);
    setScenarioMode('selection');
  };

  const handleAddWord = async (text: string) => {
    if (!text) return;
    setIsLoading(true);
    try {
      const details = await generateWordDetails(text);
      if (details) {
        const isDuplicate = words.some(w => w.text.toLowerCase() === text.toLowerCase());
        if (!isDuplicate) {
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
            await setDoc(doc(db, 'words', newWord.id), { ...newWord, userId: user.uid });
          }
          saveWords([newWord, ...words]);
        }
      }
    } catch (e) {
      console.error("Error adding word:", e);
    } finally {
      setIsLoading(false);
      setIsAddingWord(false);
      setNewWordInput('');
    }
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
          await updateDoc(doc(db, 'words', id), {
            ukPhonetic: details.ukPhonetic,
            usPhonetic: details.usPhonetic,
            pos: details.pos,
            definition: details.definition,
            examples: details.examples,
            collocations: details.collocations,
          });
        } catch (e) {
          handleFirestoreError(e, 'refresh_word', `words/${id}`);
        }
      }
      saveWords(updatedWords);
    }
    setIsLoading(false);
  };

  const handleDeleteWord = async (id: string) => {
    const nextWords = words.filter(w => w.id !== id);
    setWords(nextWords);
    
    if (user) {
      try {
        await deleteDoc(doc(db, 'words', id));
      } catch (e) {
        handleFirestoreError(e, 'delete_word', `words/${id}`);
      }
    } else {
      localStorage.setItem('lexiloop_words', JSON.stringify(nextWords));
    }

    if (selectedWordIds.has(id)) {
      const next = new Set(selectedWordIds);
      next.delete(id);
      setSelectedWordIds(next);
    }
  };

  const handleInspect = async (word: string) => {
    setIsLoading(true);
    const details = await generateWordDetails(word);
    if (details) {
      setInspectedWord({ text: word, details });
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Side/Bottom Nav */}
      <nav className="fixed left-0 lg:top-0 bottom-0 lg:h-full w-full lg:w-20 bg-white border-t lg:border-t-0 lg:border-r border-gray-100 flex lg:flex-col items-center py-4 lg:py-8 z-50 shadow-lg lg:shadow-sm">
        <div className="hidden lg:block mb-12">
          <div className="w-11 h-11 bg-blue-600 rounded-[14px] flex items-center justify-center text-white font-bold text-xl shadow-lg">L</div>
        </div>
        <div className="flex lg:flex-col items-center justify-around lg:justify-start w-full lg:w-auto gap-2 lg:gap-6 flex-1 px-4 lg:px-0">
          <NavIcon icon={<BookOpen size={22} />} active={activeTab === 'book'} onClick={() => { setActiveTab('book'); setMode('normal'); }} label="首页" />
          <NavIcon icon={<Headphones size={22} />} active={activeTab === 'review'} onClick={() => { setActiveTab('review'); setMode('normal'); }} label="复习" />
          <NavIcon icon={<MessageSquare size={22} />} active={activeTab === 'chat'} onClick={() => { setActiveTab('chat'); setMode('normal'); }} label="对话" />
          
          <div className="lg:hidden flex items-center justify-center w-12 h-12">
            {user ? (
               <button onClick={handleLogout} className="text-gray-300 hover:text-red-500 p-2">
                 <LogOut size={22} />
               </button>
            ) : (
                <button onClick={handleLogin} className="text-gray-400 p-2">
                  <LogIn size={22} />
                </button>
            )}
          </div>
        </div>
        
        <div className="hidden lg:flex mt-auto border-t border-gray-100 w-full pt-8 flex-col items-center gap-6">
          {user ? (
            <>
              <div className="w-10 h-10 rounded-full border-2 border-gray-100 overflow-hidden shadow-sm">
                <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} referrerPolicy="no-referrer" alt="Avatar" />
              </div>
              <button onClick={handleLogout} className="text-gray-300 hover:text-red-500 transition-colors">
                <LogOut size={20} />
              </button>
            </>
          ) : (
            <button onClick={handleLogin} className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-gray-100 hover:text-black transition-all">
              <LogIn size={20} />
            </button>
          )}
        </div>
      </nav>

      {/* Main Container */}
      <main className="lg:pl-20 pb-24 lg:pb-0 min-h-screen">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-8 lg:py-10">
          
          <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight font-serif uppercase">
                {activeTab === 'book' && (mode === 'flashcard' ? "Immersion Flashcards" : mode === 'podcast' ? "Listening Podcast" : "首页 (生词本)")}
                {activeTab === 'review' && "背单词 (针对性复习)"}
                {activeTab === 'chat' && (selectedScenario ? selectedScenario.title : "对话练习")}
              </h1>
              <p className="text-gray-400 mt-1 font-medium text-xs uppercase tracking-widest">
                {activeTab === 'book' && (mode === 'normal' ? `${words.length} items logged` : "Refining through synthesis")}
                {activeTab === 'review' && "科学记忆曲线驱动"}
                {activeTab === 'chat' && "AI-enhanced professional practice"}
              </p>
            </div>
            
            {mode !== 'normal' && (
               <button onClick={handleExitMode} className="text-gray-400 hover:text-black font-bold text-sm flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
                 <ChevronLeft size={18} /> 返回
               </button>
            )}

          </header>

          <AnimatePresence mode="wait">
            {activeTab === 'book' && mode === 'normal' && (
              <motion.div key="book-root" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                {/* Top Action Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Card: Add Word */}
                  <div 
                    onClick={() => setIsAddingWord(true)}
                    className="bg-white border border-gray-100 p-10 rounded-[40px] shadow-2xl shadow-gray-100/50 flex flex-col items-center justify-center text-center space-y-6 cursor-pointer hover:scale-[1.02] transition-all group"
                  >
                    <div className="w-16 h-16 bg-blue-600 text-white rounded-3xl flex items-center justify-center shadow-xl shadow-blue-100 group-hover:rotate-12 transition-transform">
                      <Plus size={32} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">录入/上传生词</h3>
                      <p className="text-gray-400 text-sm mt-1">快捷录入职场表达</p>
                    </div>
                  </div>

                  {/* Right Card: Generate Podcast */}
                  <div 
                    onClick={isSelectionMode ? undefined : handleStartSelection}
                    className={cn(
                      "p-10 rounded-[40px] border-2 flex flex-col items-center justify-center text-center space-y-6 transition-all duration-500",
                      isSelectionMode 
                        ? "bg-blue-50 border-blue-200 shadow-inner" 
                        : selectedWordIds.size > 0 
                          ? "bg-emerald-50/50 border-emerald-100 cursor-pointer shadow-xl" 
                          : "bg-white border-gray-100 hover:border-blue-200 cursor-pointer shadow-2xl shadow-gray-100/50 hover:scale-[1.02]"
                    )}
                  >
                    <div className={cn(
                      "w-16 h-16 rounded-3xl flex items-center justify-center transition-all duration-500 shadow-lg",
                      isSelectionMode ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400 group-hover:scale-110"
                    )}>
                      {isSelectionMode ? <Check size={32} /> : <Headphones size={32} />}
                    </div>
                    
                    <div>
                      <h3 className="text-xl font-bold">
                        {isSelectionMode ? "请勾选单词" : "生成场景对话"}
                      </h3>
                      <p className="text-gray-400 text-sm mt-1">
                        {isSelectionMode 
                          ? `已选中 ${selectedWordIds.size} 个词`
                          : "基于词汇模拟地道表达"}
                      </p>
                    </div>

                    {isSelectionMode && (
                      <div className="flex gap-3 w-full pt-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleCancelSelection(); }}
                          className="flex-1 py-3 rounded-2xl font-bold bg-white border border-gray-200 text-gray-400 hover:bg-gray-50 transition-all text-xs"
                        >
                          取消
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleGeneratePodcast(); }}
                          disabled={selectedWordIds.size === 0 || isLoading}
                          className={cn(
                            "flex-[2] py-3 rounded-2xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 text-xs",
                            selectedWordIds.size > 0 
                              ? "bg-blue-600 text-white shadow-blue-100" 
                              : "bg-gray-200 text-gray-400 cursor-not-allowed"
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
                <div className="space-y-10">
                  {words.length === 0 ? (
                    <div className="bg-white border border-gray-100 rounded-[40px] p-20 text-center text-gray-300 shadow-sm">
                      <BookOpen size={64} className="mx-auto mb-6 opacity-20" />
                      <p className="text-lg font-bold">Your Archive is Waiting</p>
                      <p className="text-sm mt-2">Start adding words from chat or manual entry.</p>
                    </div>
                  ) : (
                    Object.entries(
                      words.reduce((acc, word) => {
                        const date = new Date(word.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
                        if (!acc[date]) acc[date] = [];
                        acc[date].push(word);
                        return acc;
                      }, {} as Record<string, Word[]>)
                    )
                    .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime())
                    .map(([date, group]: [string, Word[]]) => (
                      <div key={date} className="space-y-4">
                        <div className="flex items-center gap-4 px-6">
                          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-300">{date}</span>
                          <div className="h-px bg-gray-100 flex-1" />
                        </div>

                        <div className="bg-white border border-gray-100 rounded-[40px] overflow-hidden p-6 shadow-xl shadow-gray-100/50 space-y-2">
                          {group.map(w => (
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
                    ))
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
                highlightWords={learningWords}
                onInspect={handleInspect}
              />
            )}

            {activeTab === 'chat' && (
              <AnimatePresence mode="wait">
                {!selectedScenario ? (
                  <motion.div key="chat-root" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-12">
                    {/* Manual Create Section */}
                    <div className="bg-white border border-gray-100 rounded-[40px] p-10 shadow-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50/50 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl -z-10" />
                      <div className="flex items-center justify-between">
                         <div className="space-y-4 max-w-lg">
                            <h2 className="text-3xl font-bold">手动创建对话</h2>
                            <p className="text-gray-400 text-sm">自定义场景、角色与目标。无论是模拟面试、客户会议还是日常闲聊，由你来定义规则。</p>
                            <button 
                              onClick={() => { setIsAddingScenario(true); setScenarioMode('selection'); }}
                              className="bg-gray-900 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 hover:bg-black transition-all hover:scale-105 active:scale-95"
                            >
                              <Plus size={20} />
                              立即创建
                            </button>
                         </div>
                         <div className="hidden md:flex w-40 h-40 bg-emerald-50 rounded-[40px] items-center justify-center text-emerald-600 shadow-inner group-hover:rotate-6 transition-transform">
                            <MessageSquare size={80} />
                         </div>
                      </div>
                    </div>

                    {/* Categories and Grid */}
                    <div className="space-y-8">
                       <div className="space-y-6 border-b border-gray-100 pb-8">
                          <h3 className="text-2xl font-bold flex items-center gap-3">
                            <Sparkles className="text-blue-600" />
                            推荐话题
                          </h3>
                          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                             {['All', 'Workplace', 'Shopping', 'Daily', 'Travel', 'Other'].map(cat => (
                               <button 
                                 key={cat} 
                                 onClick={() => setSelectedCategory(cat)}
                                 className={cn(
                                   "px-6 py-2 rounded-xl border text-xs font-bold whitespace-nowrap transition-all shadow-sm",
                                   selectedCategory === cat 
                                     ? "bg-blue-600 border-blue-600 text-white" 
                                     : "bg-white border-gray-100 text-gray-500 hover:bg-gray-50"
                                 )}
                               >
                                 {cat}
                               </button>
                             ))}
                          </div>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                         {[...scenarios]
                           .sort((a, b) => {
                             const aIsDefault = DEFAULT_SCENARIOS.some(ds => ds.id === a.id);
                             const bIsDefault = DEFAULT_SCENARIOS.some(ds => ds.id === b.id);
                             if (!aIsDefault && bIsDefault) return -1;
                             if (aIsDefault && !bIsDefault) return 1;
                             return 0;
                           })
                           .filter(s => selectedCategory === 'All' || s.category === selectedCategory)
                           .map(s => <ScenarioCard key={s.id} scenario={s} onClick={() => setSelectedScenario(s)} />)
                         }
                       </div>
                    </div>
                  </motion.div>
                ) : (
                  <ChatInterface scenario={selectedScenario} onBack={() => setSelectedScenario(null)} onAddWord={handleAddWord} />
                )}
              </AnimatePresence>
            )}

            {activeTab === 'review' && (
              <motion.div key="review-root" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-100 rounded-[40px] p-8 shadow-2xl shadow-gray-100/50 flex items-center gap-8 group">
                    <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-[32px] flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                      <Clock size={40} />
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">待复习单词列表</p>
                      <h3 className="text-4xl font-black mt-1">{dueWords.length} <span className="text-lg font-bold text-gray-300">Tokens</span></h3>
                      <p className="text-amber-600 text-[10px] font-bold mt-1 uppercase">根据艾宾浩斯曲线计算</p>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-100 rounded-[40px] p-8 shadow-2xl shadow-gray-100/50 flex items-center gap-8 group">
                    <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-[32px] flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                      <Award size={40} />
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">复习进度</p>
                      <h3 className="text-4xl font-black mt-1">
                        {words.filter(w => w.masteryLevel >= 6).length}/{words.length}
                      </h3>
                      <p className="text-emerald-600 text-[10px] font-bold mt-1 uppercase">已掌握 / 总计词库</p>
                    </div>
                  </div>
                </div>

                {/* Training Modes Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

      {/* Add Word Modal */}
      <AnimatePresence>
        {isAddingWord && (
          <div className="fixed inset-0 bg-black/10 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white max-w-xl w-full rounded-3xl p-8 relative shadow-2xl">
              <button onClick={() => setIsAddingWord(false)} className="absolute top-6 right-6 text-gray-300"><X size={24} /></button>
              <h3 className="text-2xl font-bold mb-8">Add to Loop</h3>
              <input 
                autoFocus value={newWordInput} onChange={e => setNewWordInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddWord(newWordInput)}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 px-6 text-xl font-bold focus:ring-4 focus:ring-blue-100"
                placeholder="New word..." 
              />
              <button 
                disabled={isLoading} onClick={() => handleAddWord(newWordInput)}
                className="w-full bg-black text-white py-5 rounded-2xl mt-8 font-bold flex items-center justify-center gap-3"
              >
                {isLoading ? <div className="w-6 h-6 border-4 border-t-white rounded-full animate-spin" /> : "ARCHIVE"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Scenario Modal */}
      <AnimatePresence>
        {isAddingScenario && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-xl z-[150] flex items-center justify-center p-6">
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white max-w-2xl w-full rounded-[40px] p-10 relative shadow-2xl max-h-[90vh] overflow-y-auto">
              <button onClick={() => { setIsAddingScenario(false); setScenarioMode('selection'); }} className="absolute top-8 right-8 text-gray-300 hover:text-black transition-colors"><X size={28} /></button>
              
              {scenarioMode === 'selection' && (
                <div className="space-y-10 py-4">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-50">
                      <Plus size={32} />
                    </div>
                    <h3 className="text-3xl font-black mb-2">Create Scenario</h3>
                    <p className="text-gray-400 font-medium">How do you want to define your simulation?</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <button onClick={() => setScenarioMode('manual')} className="p-8 border-2 border-gray-100 rounded-[32px] text-left hover:border-blue-500 hover:bg-blue-50 transition-all group">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-gray-50 group-hover:scale-110 transition-transform"><FileTextIcon size={24} className="text-blue-600" /></div>
                      <h4 className="font-bold text-lg mb-1">Manual Entry</h4>
                      <p className="text-gray-400 text-sm">Type name, roles, and instructions yourself.</p>
                    </button>
                    
                    <button onClick={() => setScenarioMode('image')} className="p-8 border-2 border-gray-100 rounded-[32px] text-left hover:border-emerald-500 hover:bg-emerald-50 transition-all group">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-gray-50 group-hover:scale-110 transition-transform"><ImageIcon size={24} className="text-emerald-600" /></div>
                      <h4 className="font-bold text-lg mb-1">From Image</h4>
                      <p className="text-gray-400 text-sm">Upload a photo to extract context instantly.</p>
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
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110] flex items-start justify-center p-6 overflow-y-auto pt-20"
          >
            <motion.div 
              onClick={(e) => e.stopPropagation()}
              initial={{ y: 20, opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: 20, opacity: 0 }} 
              className="bg-white max-w-lg w-full rounded-[40px] p-10 shadow-2xl relative mb-12"
            >
              <button 
                onClick={() => setInspectedWord(null)} 
                className="absolute top-8 right-8 text-gray-300 hover:text-black transition-colors z-10"
              >
                <X size={28} />
              </button>
              
              <div className="mb-8">
                <div className="flex items-center gap-6 mb-2">
                  <h2 className="text-4xl font-extrabold">{inspectedWord.text}</h2>
                  <span className="text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded-lg text-sm">{inspectedWord.details.pos}</span>
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
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Definition</h4>
                  <p className="text-xl font-bold text-gray-800 leading-relaxed">{inspectedWord.details.definition}</p>
                </section>

                {inspectedWord.details.collocations && inspectedWord.details.collocations.length > 0 && (
                  <section>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Collocations</h4>
                    <div className="flex flex-wrap gap-2">
                      {inspectedWord.details.collocations.map((c: any, i: number) => (
                        <div key={i} className="bg-gray-50 px-3 py-2 rounded-xl border border-gray-100 flex items-center gap-3 group/coll">
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
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Contextual Examples</h4>
                  <div className="space-y-4">
                    {inspectedWord.details.examples.map((ex: any, i: number) => (
                      <div key={i} className="bg-gray-50 border border-gray-100 p-4 rounded-2xl flex justify-between items-start group/ex">
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
                    "w-full py-5 rounded-3xl font-bold transition-all flex items-center justify-center gap-3 shadow-xl",
                    words.some(w => w.text.toLowerCase() === inspectedWord.text.toLowerCase())
                      ? "bg-emerald-50 text-emerald-600 cursor-default shadow-none border border-emerald-100"
                      : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100"
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
        {isLoading && !isAddingWord && !inspectedWord && (
          <div className="fixed bottom-10 right-10 z-[100] bg-white border border-gray-100 p-4 rounded-2xl shadow-2xl flex items-center gap-4 border-l-4 border-l-blue-600">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Gemini is processing...</span>
          </div>
        )}
      </AnimatePresence>
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
      className="bg-white border border-gray-100 rounded-[40px] p-10 shadow-2xl flex flex-col items-center text-center space-y-6 cursor-pointer hover:scale-[1.05] transition-all group shadow-gray-100/50"
    >
      <div className={cn("w-20 h-20 bg-gray-50 text-gray-400 rounded-3xl flex items-center justify-center transition-all shadow-inner", colorMap[color])}>
        {icon}
      </div>
      <div>
        <h4 className="text-lg font-bold mb-2">{title}</h4>
        <p className="text-gray-400 text-xs leading-relaxed font-medium">{description}</p>
      </div>
    </div>
  );
}

function NavIcon({ icon, active, onClick, label }: { icon: React.ReactNode, active: boolean, onClick: () => void, label: string }) {
  return (
    <button onClick={onClick} className={cn("group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all", active ? "bg-blue-600 text-white shadow-xl shadow-blue-200" : "text-gray-300 hover:text-gray-600")}>
      {icon}
      {active && <motion.div layoutId="rail" className="absolute -left-4 w-1.5 h-6 bg-blue-600 rounded-r-full hidden lg:block" />}
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
    <div className={cn("p-8 rounded-[32px] border flex items-center gap-6 shadow-sm", colors[color])}>
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
  const [data, setData] = useState({ title: '', description: '', systemPrompt: '', initialMessage: '', category: 'Workplace' as Scenario['category'] });
  
  return (
    <div className="space-y-8 py-4">
      <div className="flex items-center justify-between items-start">
        <div>
          <h3 className="text-2xl font-black">Manual Config</h3>
          <p className="text-gray-400 text-sm">Define the boundaries of your simulation.</p>
        </div>
        <button onClick={onBack} className="text-gray-400 hover:text-black font-bold text-sm">CANCEL</button>
      </div>
      
      <div className="space-y-6">
        <div>
          <label className="text-[10px] uppercase font-bold text-gray-400 tracking-widest block mb-2">Scenario Title</label>
          <input 
            value={data.title} onChange={e => setData({...data, title: e.target.value})}
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 font-bold focus:ring-4 focus:ring-blue-100 outline-none transition-all"
            placeholder="e.g. Asking for a Salary Raise"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
           <div>
            <label className="text-[10px] uppercase font-bold text-gray-400 tracking-widest block mb-2">Category</label>
            <select 
              value={data.category} onChange={e => setData({...data, category: e.target.value as any})}
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 font-bold outline-none cursor-pointer"
            >
              <option value="Workplace">Workplace</option>
              <option value="Daily">Daily</option>
              <option value="Travel">Travel</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-gray-400 tracking-widest block mb-2">Initial Message</label>
            <input 
              value={data.initialMessage} onChange={e => setData({...data, initialMessage: e.target.value})}
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 font-bold outline-none"
              placeholder="How AI starts..."
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase font-bold text-gray-400 tracking-widest block mb-2">Description</label>
          <textarea 
            value={data.description} onChange={e => setData({...data, description: e.target.value})}
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 font-medium outline-none min-h-[80px]"
            placeholder="Short context for your library..."
          />
        </div>
        <div>
          <label className="text-[10px] uppercase font-bold text-gray-400 tracking-widest block mb-2">AI Master Plan (System Prompt)</label>
          <textarea 
            value={data.systemPrompt} onChange={e => setData({...data, systemPrompt: e.target.value})}
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 font-medium outline-none min-h-[120px]"
            placeholder="Instruct the AI: 'You are a difficult boss who...'"
          />
        </div>
      </div>
      
      <button 
        onClick={() => {
          if (!data.title || !data.systemPrompt) return;
          onSave({ ...data, id: Date.now().toString() });
        }}
        className="w-full bg-blue-600 text-white py-5 rounded-[24px] font-bold text-lg shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
      >
        CONFIRM & SAVE
      </button>
    </div>
  );
}

function ImageScenarioExtractor({ onExtracted, onBack, onLoading }: { onExtracted: (s: Scenario) => void, onBack: () => void, onLoading: (l: boolean) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    onLoading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const result = await parseScenarioFromImage(base64, file.type);
      if (result) {
        onExtracted({ ...result, id: Date.now().toString() });
      }
      onLoading(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-10 py-10 text-center">
      <div>
        <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
          <ImageIcon size={32} />
        </div>
        <h3 className="text-3xl font-black mb-2">Instant Scenario Extraction</h3>
        <p className="text-gray-400 max-w-sm mx-auto">Upload a screenshot from a movie, a page from a book, or a workplace screenshot. AI will generate a training session for you.</p>
      </div>
      
      <div className="border-4 border-dashed border-gray-100 rounded-[40px] p-20 hover:border-emerald-200 hover:bg-emerald-50/20 transition-all group flex flex-col items-center justify-center cursor-pointer" onClick={() => fileRef.current?.click()}>
        <input type="file" ref={fileRef} hidden accept="image/*" onChange={handleFile} />
        <Upload size={48} className="text-gray-200 group-hover:text-emerald-500 transition-colors mb-4" />
        <p className="text-gray-400 font-bold group-hover:text-emerald-600">Select an image to analyze</p>
      </div>
      
      <button onClick={onBack} className="text-gray-400 font-bold hover:text-black">GO BACK</button>
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
  
  const hasMissingData = !word.ukPhonetic || !word.collocations || word.collocations.length === 0;

  return (
    <div className={cn("p-4 transition-all rounded-2xl group", expanded ? "bg-gray-50 my-4 shadow-sm ring-1 ring-gray-200/50" : "hover:bg-gray-50")}>
      <div className="flex items-center gap-4">
        {isSelectionMode && (
          <button onClick={onSelect} className={cn("transition-all h-8 w-8 rounded-xl flex items-center justify-center", selected ? "bg-blue-600 text-white shadow-lg shadow-blue-100" : "bg-gray-100 text-gray-300 hover:text-gray-400")}>
            {selected ? <Check size={18} /> : <Square size={18} />}
          </button>
        )}
        <div className="flex-1 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-4 flex-wrap">
            <h4 className="font-extrabold text-xl">{word.text}</h4>
            {word.pos && <span className="text-blue-600 font-bold text-[10px] bg-blue-50 px-2 py-0.5 rounded-full ring-1 ring-blue-100">{word.pos}</span>}
            
            <div className="flex gap-4 text-gray-400 font-mono text-[11px] items-center">
              <button 
                onClick={(e) => { e.stopPropagation(); speak(word.text, { accent: 'UK' }); }}
                className={cn("flex items-center gap-1.5 transition-colors", word.ukPhonetic ? "hover:text-blue-600" : "opacity-30")}
              >
                <span className="font-bold bg-gray-100 px-1.5 rounded text-[9px] text-gray-500 uppercase">UK</span> 
                {word.ukPhonetic || "---"}
                <Volume2 size={12} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); speak(word.text, { accent: 'US' }); }}
                className={cn("flex items-center gap-1.5 transition-colors", word.usPhonetic ? "hover:text-blue-600" : "opacity-30")}
              >
                <span className="font-bold bg-gray-100 px-1.5 rounded text-[9px] text-gray-500 uppercase">US</span> 
                {word.usPhonetic || "---"}
                <Volume2 size={12} />
              </button>
            </div>

            {hasMissingData && (
              <button 
                onClick={(e) => { e.stopPropagation(); onRefresh?.(); }}
                className="text-[9px] font-black uppercase text-amber-500 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100 flex items-center gap-1 hover:bg-amber-100 transition-all ml-auto md:ml-0"
              >
                <RotateCcw size={10} /> Data Incomplete - Sync?
              </button>
            )}
          </div>
          {!expanded && <p className="text-gray-500 text-sm mt-1 font-medium">{word.definition}</p>}
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <button onClick={onDelete} className="p-2.5 md:p-3 bg-white border border-gray-100 rounded-2xl text-gray-300 hover:text-red-500 hover:border-red-100 transition-all shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100">
            <Trash2 size={18} />
          </button>
          <button onClick={onPlay} className="p-2.5 md:p-3 bg-white border border-gray-100 rounded-2xl text-gray-300 hover:text-blue-600 transition-all shadow-sm">
            <Volume2 size={18} />
          </button>
        </div>
      </div>
      
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-8 pt-8 border-t border-gray-200/50 space-y-8">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h5 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Definition</h5>
                <button onClick={() => speak(word.definition)} className="text-gray-300 hover:text-blue-600 transition-colors"><Volume2 size={14} /></button>
              </div>
              <p className="text-gray-900 font-bold text-2xl leading-tight">{word.definition}</p>
            </div>
            
            <div className="space-y-4">
              <h5 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Common Collocations</h5>
              {word.collocations && word.collocations.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {word.collocations.map((c, i) => (
                    <div key={i} className="bg-white px-4 py-3 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 hover:border-blue-200 hover:bg-blue-50/10 transition-all group/coll">
                      <div>
                        <span className="font-bold text-gray-800 text-sm block">{c.phrase}</span>
                        <span className="text-xs text-gray-400">{c.translation}</span>
                      </div>
                      <button onClick={() => speak(c.phrase)} className="text-gray-300 group-hover/coll:text-blue-500 transition-colors">
                        <Volume2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 border-2 border-dashed border-gray-100 rounded-3xl text-center">
                  <p className="text-gray-300 text-sm italic">No collocation data found for this entry.</p>
                  <button onClick={onRefresh} className="mt-2 text-xs font-bold text-blue-500 hover:underline">Re-run AI Analysis</button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h5 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Contextual Examples</h5>
              <div className="space-y-4">
                {word.examples.map((ex, i) => (
                  <div key={i} className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm flex justify-between items-start hover:shadow-lg hover:border-emerald-100 transition-all group/ex">
                    <div className="flex-1">
                      <p className="font-bold text-gray-800 text-base mb-2 italic leading-relaxed">"{ex.sentence}"</p>
                      <p className="text-sm text-gray-400 font-medium">{ex.translation}</p>
                    </div>
                    <button onClick={() => speak(ex.sentence)} className="p-3 text-gray-200 group-hover/ex:text-emerald-500 transition-colors">
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
  );
};

const ScenarioCard: React.FC<{ scenario: Scenario, onClick: () => void }> = ({ scenario, onClick }) => {
  const isCustom = !DEFAULT_SCENARIOS.some(ds => ds.id === scenario.id);
  const Icon = scenario.category === 'Workplace' ? Briefcase : scenario.category === 'Shopping' ? ShoppingBag : scenario.category === 'Travel' ? Plane : scenario.category === 'Daily' ? Coffee : MessageSquare;
  const colorClass = scenario.category === 'Workplace' ? 'text-blue-600 bg-blue-50' : scenario.category === 'Shopping' ? 'text-emerald-600 bg-emerald-50' : scenario.category === 'Travel' ? 'text-amber-600 bg-amber-50' : 'text-gray-600 bg-gray-50';

  return (
    <button onClick={onClick} className="bg-white border border-gray-100 p-6 md:p-8 rounded-[32px] md:rounded-[40px] text-left hover:border-blue-400 hover:shadow-2xl transition-all group overflow-hidden flex flex-col h-full shadow-sm shadow-gray-100/20 relative">
      {isCustom && (
        <div className="absolute top-4 right-4 md:top-6 md:right-6 px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-full ring-1 ring-amber-200">
          Manual
        </div>
      )}
      <div className={cn("w-12 h-12 md:w-14 md:h-14 rounded-2xl md:rounded-3xl flex items-center justify-center mb-6 transition-all transform group-hover:scale-110", colorClass)}>
        <Icon size={24} className="md:w-7 md:h-7" />
      </div>
      <div className="flex-1">
        <h3 className="text-lg md:text-xl font-bold mb-2 group-hover:text-blue-600 transition-colors uppercase tracking-tight line-clamp-1">{scenario.title}</h3>
        <p className="text-gray-400 text-[11px] md:text-xs font-medium leading-relaxed mb-6 line-clamp-3 italic">{scenario.description}</p>
      </div>
      <div className="flex items-center justify-between w-full mt-auto pt-4 border-t border-gray-50">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">{scenario.category}</span>
        <div className="flex items-center gap-1 text-blue-600 font-bold text-[10px] uppercase tracking-widest bg-blue-50 px-3 py-1.5 rounded-full ring-1 ring-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-all">
          ENTER <ChevronRight size={14} />
        </div>
      </div>
    </button>
  );
};

function ChatInterface({ scenario, onBack, onAddWord }: { scenario: Scenario, onBack: () => void, onAddWord: (t: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const { listen, isListening, speak } = useSpeech();

  useEffect(() => { 
    // Initial message
    setMessages([{ role: 'model', text: scenario.initialMessage }]); 
    // Small delay to let UI settle then speak and listen
    const timer = setTimeout(() => {
      speak(scenario.initialMessage);
      // Automatically start listening after the first message
      listen(setInputText);
    }, 500);
    return () => clearTimeout(timer);
  }, [scenario]);

  const handleSend = async (t?: string) => {
    const txt = t || inputText;
    if (!txt) return;
    setMessages(prev => [...prev, { role: 'user', text: txt }]);
    setInputText('');
    setSuggestion(null);
    
    const prompt = `Current Context: ${scenario.title}\nUser just said: "${txt}"\nIf the user input is partially Chinese or unclear, first provide the correct/professional English version. Then continue the roleplay naturally.`;
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
    <div className="h-[80vh] md:h-[70vh] flex flex-col bg-white border border-gray-100 rounded-[32px] overflow-hidden shadow-2xl relative">
      <div className="p-4 md:p-6 border-b border-gray-50 flex items-center justify-between">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-xl"><ChevronLeft size={24} /></button>
        <div className="flex flex-col items-center">
          <h3 className="font-bold text-sm md:text-base line-clamp-1">{scenario.title}</h3>
          <span className="text-[9px] md:text-[10px] uppercase font-bold text-emerald-500 tracking-widest leading-none">Fluid Exchange</span>
        </div>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === 'user' ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] md:max-w-[80%] p-4 rounded-[24px] md:rounded-3xl relative group text-sm md:text-base", m.role === 'user' ? "bg-gray-900 text-white rounded-tr-none" : "bg-gray-100 rounded-tl-none")}>
              <p className="leading-relaxed">{m.text}</p>
              {m.role === 'model' && (
                <button 
                  onClick={() => speak(m.text)}
                  className="absolute -right-10 top-0 p-2 text-gray-300 opacity-0 group-hover:opacity-100 hover:text-blue-600 transition-all"
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
             <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <Sparkles size={16} className="text-blue-600" />
                 <span className="text-sm font-bold text-blue-900">Recommended Phrase: <span className="italic">{suggestion}</span></span>
               </div>
               <button onClick={() => onAddWord(suggestion)} className="text-[10px] font-extrabold uppercase bg-blue-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2">
                 <Plus size={14} /> ADD TO ARCHIVE
               </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4 md:p-8 border-t border-gray-50 bg-white">
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
          <button onClick={() => handleSend()} className="bg-blue-600 text-white font-bold px-4 md:px-8 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-50 flex items-center justify-center">
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
    <div className="max-w-md mx-auto py-10 space-y-12">
      <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-widest px-4">
        <span>Token {index + 1} of {words.length}</span>
        <button onClick={onFinish} className="hover:text-black">EXIT</button>
      </div>
      
      <div className="relative h-96 perspective-1000 group cursor-pointer" onClick={() => { setFlipped(!flipped); if(!flipped) speak(current.text); }}>
        <motion.div 
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
          className="w-full h-full relative preserve-3d"
        >
          {/* Front */}
          <div className="absolute inset-0 backface-hidden bg-white border-2 border-gray-100 rounded-[40px] flex flex-col items-center justify-center p-10 shadow-2xl">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-8">
              <Volume2 size={32} />
            </div>
            <h2 className="text-4xl font-extrabold mb-4">{current.text}</h2>
            <p className="text-gray-400 font-mono italic">{current.ukPhonetic}</p>
            <p className="mt-8 text-xs font-bold text-blue-400 animate-pulse">TAP TO FLIP</p>
          </div>
          {/* Back */}
          <div className="absolute inset-0 backface-hidden bg-gray-900 border-2 border-gray-900 rounded-[40px] flex flex-col items-center justify-center p-10 text-white transform rotateY-180">
            <p className="text-2xl font-bold mb-6 text-center">{current.definition}</p>
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
                className="py-4 bg-white/10 hover:bg-white/20 rounded-2xl font-bold text-sm transition-colors"
              >
                FORGOT
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); handleAction(true); }}
                className="py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-bold text-sm transition-colors"
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
    <div className="max-w-xl mx-auto py-12">
      <div className="bg-white border border-gray-100 rounded-[40px] p-12 shadow-2xl space-y-10 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gray-100">
          <motion.div 
            className="h-full bg-emerald-500"
            initial={{ width: 0 }}
            animate={{ width: `${((index + 1) / words.length) * 100}%` }}
          />
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pronunciation Challenge</span>
          <h2 className="text-4xl font-black text-gray-800 leading-tight">请读出该单词的英文</h2>
        </div>

        <div className="py-8 px-6 bg-gray-50 rounded-3xl border border-gray-100">
           <p className="text-3xl font-bold text-gray-900">{current.definition}</p>
        </div>

        <div className="flex flex-col items-center gap-6">
          <button 
            disabled={isListening || status === 'correct'}
            onClick={handleListen}
            className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-xl active:scale-95 group relative",
              isListening ? "bg-red-500 text-white shadow-red-200" : "bg-emerald-600 text-white shadow-emerald-200 hover:scale-110"
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
          
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
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
              <div className="p-4 bg-red-50 rounded-2xl border border-red-100 italic text-red-800 text-sm">
                "{transcript}"
              </div>
              <div className="flex flex-col items-center gap-2">
                 <p className="text-xs text-gray-400 uppercase font-black tracking-widest">Target Word</p>
                 <div className="flex items-center gap-3">
                    <span className="text-2xl font-black">{current.text}</span>
                    <button onClick={() => speak(current.text)} className="p-2 bg-white border border-gray-100 rounded-xl shadow-sm text-gray-400 hover:text-blue-600 transition-all">
                       <Volume2 size={16} />
                    </button>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pt-8 border-t border-gray-50 flex items-center justify-between">
           <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Progress: {index + 1} / {words.length}</span>
           <button onClick={onFinish} className="text-[10px] font-bold text-gray-400 hover:text-black uppercase tracking-widest">Exit</button>
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
    <div className="max-w-xl mx-auto py-20">
      <div className="bg-white border border-gray-100 rounded-[40px] p-12 shadow-2xl space-y-10 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gray-100">
          <motion.div 
            className="h-full bg-emerald-500"
            initial={{ width: 0 }}
            animate={{ width: `${(index / words.length) * 100}%` }}
          />
        </div>

        <div className="flex justify-center">
          <button 
            onClick={() => speak(current.text)}
            className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-[32px] flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl shadow-emerald-50"
          >
            <Volume2 size={40} />
          </button>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-[0.3em]">Definition</h2>
          <p className="text-2xl font-black text-gray-800">{current.definition}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <input 
            autoFocus
            value={input}
            onChange={e => setInput(e.target.value)}
            className={cn(
              "w-full bg-gray-50 border-2 rounded-3xl p-6 text-center text-2xl font-black outline-none transition-all",
              status === 'correct' ? "border-emerald-500 bg-emerald-50 text-emerald-600" : 
              status === 'wrong' ? "border-red-500 bg-red-50 text-red-600 animate-shake" : 
              "border-gray-100 focus:border-emerald-400 focus:bg-white"
            )}
            placeholder="Type what you hear..."
          />
          <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4">
            <span>Progress: {index + 1} / {words.length}</span>
            <button type="button" onClick={onFinish} className="hover:text-black">GIVE UP</button>
          </div>
        </form>

        <AnimatePresence>
          {status === 'wrong' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0 }}
              className="pt-4 border-t border-red-50"
            >
              <p className="text-red-400 text-xs font-bold uppercase tracking-widest mb-1">Correct Answer:</p>
              <p className="text-2xl font-black text-red-600">{current.text}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function PodcastView({ 
  data,
  loading, 
  onSpeak, 
  onStop,
  highlightWords, 
  onInspect,
  onFinish
}: { 
  data: any,
  loading: boolean, 
  onSpeak: (t: string, opts?: { voiceType?: 'A' | 'B' }) => void,
  onStop?: () => void,
  highlightWords: string[],
  onInspect: (word: string) => void,
  onFinish: () => void,
  key?: string | number
}) {
  const [showTranslation, setShowTranslation] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const playDialogue = async () => {
    if (isPlaying) {
      setIsPlaying(false);
      setCurrentLineIndex(null);
      onStop?.();
      abortControllerRef.current?.abort();
      return;
    }

    if (!data?.lines) return;
    setIsPlaying(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      for (let i = 0; i < data.lines.length; i++) {
        if (controller.signal.aborted) break;
        const line = data.lines[i];
        setCurrentLineIndex(i);
        onSpeak(line.text, { voiceType: line.speaker });
        
        // Approximate wait time based on word count
        const wordsCount = line.text.split(' ').length;
        const delay = wordsCount * 450 + 1000;
        
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, delay);
          controller.signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new Error('aborted'));
          });
        });
      }
    } catch (e: any) {
      if (e.message !== 'aborted') console.error(e);
    } finally {
      if (!controller.signal.aborted) {
        setIsPlaying(false);
        setCurrentLineIndex(null);
      }
    }
  };

  useEffect(() => {
    return () => {
      onStop?.();
      abortControllerRef.current?.abort();
    };
  }, [onStop]);

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 md:px-10 md:py-6 bg-white border border-gray-100 rounded-[32px] shadow-2xl">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-[24px] flex items-center justify-center shadow-inner shrink-0"><Ear size={32} /></div>
          <div>
            <h3 className="font-black text-xl leading-tight">全景认知职场对话</h3>
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-[0.3em] mt-1">Multi-Role Immersive Training</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => setShowTranslation(!showTranslation)} 
            className={cn(
              "flex-1 md:flex-initial h-12 md:h-14 px-4 md:px-6 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 font-bold text-[10px] md:text-xs uppercase tracking-widest",
              showTranslation ? "bg-amber-100 text-amber-700 shadow-amber-50" : "bg-gray-50 text-gray-400 hover:text-black"
            )}
          >
            <Languages size={18} />
            {showTranslation ? "HIDE" : "SHOW"} ZH
          </button>
          <button 
            disabled={loading} 
            onClick={playDialogue} 
            className={cn(
              "flex-[2] md:flex-initial h-12 md:h-14 px-6 md:px-10 rounded-2xl transition-all shadow-xl font-bold flex items-center justify-center gap-3 text-xs md:text-sm",
              isPlaying ? "bg-red-500 text-white shadow-red-100" : "bg-emerald-600 text-white hover:scale-105 active:scale-95 shadow-emerald-100"
            )}
          >
            {isPlaying ? <Square size={20} fill="currentColor" /> : <Volume2 size={20} />}
            {isPlaying ? "STOP" : "PLAY"}
          </button>
        </div>
      </div>
      
      <div className="space-y-6">
        {loading ? (
          <div className="p-20 bg-white border border-gray-100 rounded-[40px] text-center space-y-4 shadow-xl">
             <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
             <p className="font-bold text-gray-400 animate-pulse">Gemini 正在为您构思地道的职场交流...</p>
          </div>
        ) : (
          data?.lines.map((line: any, i: number) => (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              key={i} 
              className={cn(
                "flex gap-6 items-start w-full transition-opacity",
                isPlaying && currentLineIndex !== null && currentLineIndex !== i ? "opacity-40" : "opacity-100"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg font-black text-xs uppercase",
                line.speaker === 'A' ? "bg-blue-600 text-white" : "bg-gray-900 text-white"
              )}>
                {line.name?.[0] || line.speaker}
              </div>
              <div className={cn(
                "flex-1 p-8 rounded-[32px] shadow-sm ring-1 ring-black/5 relative group bg-white",
                currentLineIndex === i && "ring-2 ring-emerald-500 shadow-xl"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn(
                     "text-[10px] font-black uppercase tracking-widest",
                     line.speaker === 'A' ? "text-blue-600" : "text-gray-900"
                  )}>
                    {line.name || (line.speaker === 'A' ? 'Person A' : 'Person B')}
                  </span>
                </div>
                <div className="text-gray-800 leading-relaxed font-medium text-lg">
                  {line.text.split(/(\s+|,|\.|\?|!|:|;|\n)/).map((token: string, ti: number) => {
                    const cleanWord = token.replace(/[^\w-]/g, '').toLowerCase();
                    const isHighlighted = highlightWords.some(hw => hw.toLowerCase() === cleanWord);
                    if (token.length === 0) return null;
                    if (cleanWord.length === 0) return <span key={ti}>{token}</span>;
                    return (
                      <span 
                        key={ti} 
                        onClick={() => onInspect(cleanWord)}
                        className={cn(
                          "cursor-pointer px-1 rounded transition-all duration-200 inline-block",
                          isHighlighted 
                            ? "bg-amber-200 text-amber-900 font-bold decoration-amber-400 decoration-2 underline-offset-4 underline" 
                            : "hover:bg-blue-100 hover:text-blue-700 text-gray-800"
                        )}
                      >
                        {token}
                      </span>
                    );
                  })}
                </div>
                {showTranslation && (
                  <div className="mt-4 pt-4 border-t border-gray-100 text-gray-400 text-sm font-medium italic">
                    {line.translation}
                  </div>
                )}
                <button 
                  onClick={() => onSpeak(line.text, { voiceType: line.speaker })}
                  className="absolute top-6 right-6 p-2 text-gray-200 opacity-0 group-hover:opacity-100 hover:text-blue-600 transition-all"
                >
                  <Volume2 size={16} />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
      
      {!loading && (
        <div className="flex justify-center pt-10">
          <button 
            onClick={onFinish}
            className="px-12 py-5 bg-gray-900 text-white rounded-[24px] font-bold text-lg shadow-2xl hover:scale-105 active:scale-95 transition-all"
          >
            完成学习，继续探索
          </button>
        </div>
      )}
    </div>
  );
}
