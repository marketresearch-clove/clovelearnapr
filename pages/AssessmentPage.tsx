
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
  id: string;
  name: string;
  avatar: string;
}

const users: User[] = [
  { id: '1', name: 'Helene', avatar: 'https://i.pravatar.cc/150?u=helene' },
  { id: '2', name: 'Rio', avatar: 'https://i.pravatar.cc/150?u=rio' },
  { id: '3', name: 'John Michael', avatar: 'https://i.pravatar.cc/150?u=john' },
];

const AssessmentPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeUser, setActiveUser] = useState<string | null>(null);
  
  // State to store ratings: { questionId: { userId: score } }
  const [ratings, setRatings] = useState<Record<string, Record<string, number>>>({
    q1: { '1': 20, '2': 50, '3': 50 }, // Initial positions for demo
    q2: { '1': 1, '2': 3, '3': 4 }
  });

  const handleRating = (questionId: string, value: number) => {
    if (!activeUser) return;
    setRatings(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [activeUser]: value
      }
    }));
  };

  const getAvatarPositionStyle = (value: number, type: 'scale' | 'level') => {
    if (type === 'scale') {
      // Scale 0-100%
      return { left: `${value}%` };
    } else {
      // Levels 1-5, centered in each 20% block
      // Level 1 = 10%, Level 2 = 30%, etc.
      const percent = (value - 1) * 20 + 10; 
      return { left: `${percent}%` };
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
            <span className="material-symbols-rounded">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold text-slate-800">Manager Feedback</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
        {/* Filter */}
        <div className="flex items-center gap-4">
          <label className="font-semibold text-slate-700">Skill name</label>
          <div className="relative">
             <select className="appearance-none bg-white border border-slate-300 hover:border-slate-400 px-4 py-2 pr-10 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500">
               <option>Customer Orientation</option>
               <option>Strategic Thinking</option>
               <option>Team Leadership</option>
             </select>
             <span className="material-symbols-rounded absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">expand_more</span>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-blue-800 text-sm flex items-start gap-3">
          <span className="material-symbols-rounded text-blue-500">info</span>
          <p>Click on a team member's avatar below to select them, then click on the rating scale to place them. You can move multiple users.</p>
        </div>

        {/* Question 1 - Continuous Scale */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="mb-8">
             <h2 className="text-lg text-slate-800 mb-6">
               1. Your team member has an in-depth understanding of the customer issues and pulse? <span className="text-slate-400 text-sm">(Select user and click scale to rate)</span>
             </h2>
             
             {/* Users Selection */}
             <div className="flex gap-6 mb-12">
               {users.map(user => (
                 <button 
                   key={user.id}
                   onClick={() => setActiveUser(user.id)}
                   className={`flex flex-col items-center gap-2 group transition-all ${activeUser === user.id ? 'scale-110' : 'opacity-70 hover:opacity-100'}`}
                 >
                   <div className={`w-14 h-14 rounded-full p-1 ${activeUser === user.id ? 'bg-primary-500 ring-4 ring-primary-100' : 'bg-transparent'}`}>
                     <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover border-2 border-white" />
                   </div>
                   <span className={`text-sm font-medium ${activeUser === user.id ? 'text-primary-700' : 'text-slate-600'}`}>{user.name}</span>
                 </button>
               ))}
             </div>

             {/* Scale Container */}
             <div className="relative pt-12 pb-6 px-4"> 
               {/* Placed Pins */}
               {users.map(user => {
                 const val = ratings['q1']?.[user.id];
                 if (val === undefined) return null;
                 return (
                   <div 
                     key={user.id} 
                     className="absolute top-0 w-10 flex flex-col items-center transition-all duration-500 z-10 -translate-x-1/2 pointer-events-none"
                     style={getAvatarPositionStyle(val, 'scale')}
                   >
                     {/* Badge count if overlapping could be handled here, simplified for now */}
                     <div className={`w-10 h-10 rounded-full border-2 border-white shadow-md overflow-hidden ${activeUser === user.id ? 'ring-2 ring-primary-500' : ''}`}>
                       <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                     </div>
                     <div className="w-0.5 h-4 bg-slate-300 mt-1"></div>
                   </div>
                 );
               })}

               {/* The Scale Bar */}
               <div className="h-12 flex rounded-lg overflow-hidden text-xs font-medium text-slate-600 relative cursor-pointer shadow-inner">
                  {/* Click Handling Overlay */}
                  <div 
                    className="absolute inset-0 z-20"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
                      handleRating('q1', percentage);
                    }}
                  ></div>

                  <div className="flex-1 bg-blue-200/50 flex items-center justify-center border-r border-white/50">Strongly disagree</div>
                  <div className="flex-1 bg-blue-200/30 flex items-center justify-center border-r border-white/50">Disagree</div>
                  <div className="flex-1 bg-slate-200/50 flex items-center justify-center border-r border-white/50">Neutral</div>
                  <div className="flex-1 bg-purple-200/30 flex items-center justify-center border-r border-white/50">Agree</div>
                  <div className="flex-1 bg-purple-200/50 flex items-center justify-center">Strongly agree</div>
               </div>
             </div>
          </div>
        </div>

        {/* Question 2 - Discrete Levels */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
           <h2 className="text-lg text-slate-800 mb-6">
             2. Which of the following behaviours are usually displayed/ likely to be displayed by your team member at the workplace?
           </h2>
           
            {/* Users Selection */}
            <div className="flex gap-6 mb-12">
               {users.map(user => (
                 <button 
                   key={user.id}
                   onClick={() => setActiveUser(user.id)}
                   className={`flex flex-col items-center gap-2 group transition-all ${activeUser === user.id ? 'scale-110' : 'opacity-70 hover:opacity-100'}`}
                 >
                   <div className={`w-14 h-14 rounded-full p-1 ${activeUser === user.id ? 'bg-primary-500 ring-4 ring-primary-100' : 'bg-transparent'}`}>
                     <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover border-2 border-white" />
                   </div>
                   <span className={`text-sm font-medium ${activeUser === user.id ? 'text-primary-700' : 'text-slate-600'}`}>{user.name}</span>
                 </button>
               ))}
             </div>

           {/* Levels Container */}
           <div className="relative pt-10">
              {/* Placed Pins */}
              {users.map(user => {
                 const val = ratings['q2']?.[user.id];
                 if (!val) return null;
                 return (
                   <div 
                     key={user.id} 
                     className="absolute top-0 w-10 flex flex-col items-center transition-all duration-500 z-10 -translate-x-1/2 pointer-events-none"
                     style={getAvatarPositionStyle(val, 'level')}
                   >
                     <div className={`w-10 h-10 rounded-full border-2 border-white shadow-md overflow-hidden ${activeUser === user.id ? 'ring-2 ring-primary-500' : ''}`}>
                       <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                     </div>
                     <div className="w-0.5 h-6 bg-slate-300 mt-1"></div>
                   </div>
                 );
               })}

               {/* Level Headers */}
               <div className="grid grid-cols-5 gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map(level => (
                    <div 
                      key={level} 
                      className="bg-slate-200/50 rounded-t-lg py-2 text-center text-xs font-bold text-slate-600 cursor-pointer hover:bg-slate-200 transition-colors"
                      onClick={() => handleRating('q2', level)}
                    >
                       Level {level}
                       <span className="material-symbols-rounded text-base align-bottom ml-1">expand_less</span>
                    </div>
                  ))}
               </div>

               {/* Level Descriptions */}
               <div className="grid grid-cols-5 gap-1">
                  <div className="bg-blue-200/40 p-4 rounded-bl-lg text-xs text-slate-700 h-32 cursor-pointer hover:bg-blue-200/60 transition-colors" onClick={() => handleRating('q2', 1)}>
                    Needs help to be able to formulate problem statements around customer issues.
                  </div>
                  <div className="bg-blue-200/20 p-4 text-xs text-slate-700 h-32 cursor-pointer hover:bg-blue-200/40 transition-colors" onClick={() => handleRating('q2', 2)}>
                    Is able to formulate problem statements around customer issues and create solutions to resolve them.
                  </div>
                  <div className="bg-slate-100 p-4 text-xs text-slate-700 h-32 cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleRating('q2', 3)}>
                    Is able to bring problem-solving skills to resolve customer issues, efficiently and effectively.
                  </div>
                  <div className="bg-purple-200/20 p-4 text-xs text-slate-700 h-32 cursor-pointer hover:bg-purple-200/40 transition-colors" onClick={() => handleRating('q2', 4)}>
                    Has an in-depth understanding of the customer issues and pulse.
                  </div>
                  <div className="bg-purple-200/40 p-4 rounded-br-lg text-xs text-slate-700 h-32 cursor-pointer hover:bg-purple-200/60 transition-colors" onClick={() => handleRating('q2', 5)}>
                    Frequently interacts with the frontline team to understand the issues and the customer pulse.
                  </div>
               </div>
           </div>
           <div className="text-right mt-2">
             <button className="text-xs font-bold text-slate-500 hover:text-slate-800 underline uppercase tracking-wide">Show Less</button>
           </div>
        </div>
      </main>
    </div>
  );
};

export default AssessmentPage;
