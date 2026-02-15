import React, { useState, useEffect } from 'react';
import { Location, POI, StoryConfig, StoryStyle, StoryLanguage, TransportMode } from '../types';
import { searchLocation } from '../services/osmService';
import { Search, MapPin, Navigation, BookOpen, Loader2, Wand2, Target, Car, Bike, Footprints, Share2, Volume2, Square, StopCircle } from 'lucide-react';

interface SidebarProps {
  start: Location | null;
  end: Location | null;
  pois: POI[];
  setStart: (loc: Location) => void;
  setEnd: (loc: Location) => void;
  selectionMode: 'start' | 'end';
  setSelectionMode: (mode: 'start' | 'end') => void;
  onGenerateStory: (config: StoryConfig) => void;
  story: string;
  isGenerating: boolean;
  isLoadingPois: boolean;
  onPoiSelect: (poi: POI) => void;
  transportMode: TransportMode;
  setTransportMode: (mode: TransportMode) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  start,
  end,
  pois,
  setStart,
  setEnd,
  selectionMode,
  setSelectionMode,
  onGenerateStory,
  story,
  isGenerating,
  isLoadingPois,
  onPoiSelect,
  transportMode,
  setTransportMode,
}) => {
  const [startQuery, setStartQuery] = useState('');
  const [endQuery, setEndQuery] = useState('');
  const [poiSearch, setPoiSearch] = useState('');
  const [config, setConfig] = useState<StoryConfig>({
    style: StoryStyle.ADVENTURE,
    language: StoryLanguage.FRENCH,
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Load voices securely
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleSearch = async (query: string, type: 'start' | 'end') => {
    if (!query) return;
    const results = await searchLocation(query);
    if (results.length > 0) {
      const best = results[0];
      const loc: Location = {
        lat: parseFloat(best.lat),
        lng: parseFloat(best.lon),
        name: best.display_name.split(',')[0],
      };
      if (type === 'start') setStart(loc);
      else setEnd(loc);
    }
  };

  const handleShare = async () => {
    if (!start && !end) return;

    const title = 'Mon aventure TravelTale';
    const textToShare = story 
        ? `Découvre mon aventure TravelTale de ${start?.name || '?'} à ${end?.name || '?'} !\n\n${story.substring(0, 150)}...\n\n` 
        : `Je planifie un voyage de ${start?.name || '?'} à ${end?.name || '?'} sur TravelTale !`;
    
    const urlToShare = window.location.href;

    if (navigator.share) {
        try {
            await navigator.share({
                title: title,
                text: textToShare,
                url: urlToShare,
            });
        } catch (error) {
            console.log('Erreur de partage:', error);
        }
    } else {
        // Fallback clipboard
        try {
            await navigator.clipboard.writeText(`${textToShare}\n${urlToShare}`);
            alert('Lien et résumé copiés dans le presse-papier !');
        } catch (err) {
            console.error('Failed to copy: ', err);
            prompt("Copiez ce lien:", urlToShare);
        }
    }
  };

  const getLangCode = (lang: StoryLanguage) => {
    switch (lang) {
        case StoryLanguage.ENGLISH: return 'en-US';
        case StoryLanguage.SPANISH: return 'es-ES';
        case StoryLanguage.GERMAN: return 'de-DE';
        case StoryLanguage.FRENCH: 
        case StoryLanguage.AUTO:
        default: return 'fr-FR';
    }
  };

  const toggleSpeech = () => {
    if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
    } else {
        if (!story) return;
        
        const langCode = getLangCode(config.language);
        const utterance = new SpeechSynthesisUtterance(story);
        utterance.lang = langCode;
        
        // Find best voice
        // 1. Filter by language
        const langVoices = voices.filter(v => v.lang.startsWith(langCode.split('-')[0]));
        
        // 2. Search for preferred "soft/female" characteristics
        const preferredKeywords = ['female', 'google', 'samantha', 'zira', 'amelie', 'sophie', 'natural'];
        const preferredVoice = langVoices.find(v => 
            preferredKeywords.some(keyword => v.name.toLowerCase().includes(keyword))
        );

        if (preferredVoice) {
            utterance.voice = preferredVoice;
        } else if (langVoices.length > 0) {
            utterance.voice = langVoices[0];
        }
        
        // Soften parameters
        utterance.pitch = 1.05; 
        utterance.rate = 0.95;
        
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        window.speechSynthesis.speak(utterance);
        setIsSpeaking(true);
    }
  };

  const filteredPois = pois.filter(p => 
    p.name.toLowerCase().includes(poiSearch.toLowerCase())
  );

  return (
    <div className="w-full md:w-[400px] h-full bg-white shadow-xl flex flex-col z-10 border-r border-gray-200 overflow-hidden">
      <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex justify-between items-start">
        <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
            <Navigation className="w-6 h-6" />
            TravelTale-OSM
            </h1>
            <p className="text-blue-100 text-sm mt-1">
                Planifiez votre route, découvrez l'histoire.
            </p>
        </div>
        <button 
            onClick={handleShare} 
            className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-colors" 
            title="Partager le voyage"
        >
            <Share2 className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Route Section */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-gray-700 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Itinéraire
            </h2>
            
            {/* Transport Mode Selectors */}
            <div className="flex bg-gray-100 p-1 rounded-lg">
                <button 
                    onClick={() => setTransportMode('car')}
                    className={`p-1.5 rounded-md transition-all ${transportMode === 'car' ? 'bg-white shadow text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                    title="Voiture"
                >
                    <Car className="w-4 h-4" />
                </button>
                <button 
                    onClick={() => setTransportMode('bike')}
                    className={`p-1.5 rounded-md transition-all ${transportMode === 'bike' ? 'bg-white shadow text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                    title="Vélo"
                >
                    <Bike className="w-4 h-4" />
                </button>
                <button 
                    onClick={() => setTransportMode('foot')}
                    className={`p-1.5 rounded-md transition-all ${transportMode === 'foot' ? 'bg-white shadow text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                    title="Marche"
                >
                    <Footprints className="w-4 h-4" />
                </button>
            </div>
          </div>
          
          {/* Start Input */}
          <div className={`p-3 rounded-lg border transition-all ${selectionMode === 'start' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200'}`}>
            <label className="text-xs font-semibold text-gray-500 uppercase">Départ</label>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                className="flex-1 bg-transparent outline-none text-gray-800 placeholder-gray-400"
                placeholder="Ville de départ..."
                value={start?.name || startQuery}
                onChange={(e) => setStartQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(startQuery, 'start')}
                onClick={() => setSelectionMode('start')}
              />
              <button onClick={() => handleSearch(startQuery, 'start')} className="text-blue-600">
                <Search className="w-4 h-4" />
              </button>
            </div>
            {start && <div className="text-xs text-green-600 mt-1">Localisation définie</div>}
          </div>

          {/* End Input */}
          <div className={`p-3 rounded-lg border transition-all ${selectionMode === 'end' ? 'border-red-500 bg-red-50 ring-2 ring-red-200' : 'border-gray-200'}`}>
            <label className="text-xs font-semibold text-gray-500 uppercase">Arrivée</label>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                className="flex-1 bg-transparent outline-none text-gray-800 placeholder-gray-400"
                placeholder="Destination..."
                value={end?.name || endQuery}
                onChange={(e) => setEndQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(endQuery, 'end')}
                onClick={() => setSelectionMode('end')}
              />
              <button onClick={() => handleSearch(endQuery, 'end')} className="text-red-600">
                <Search className="w-4 h-4" />
              </button>
            </div>
             {end && <div className="text-xs text-green-600 mt-1">Localisation définie</div>}
          </div>
        </section>

        {/* POI Info & Search */}
        {start && end && (
          <section className="bg-gray-50 p-3 rounded-lg border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center justify-between">
                <span>Points d'Intérêt ({pois.length})</span>
                {isLoadingPois && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
            </h3>
            
            {/* POI Search Input */}
            <div className="mb-2 relative">
                <input 
                    type="text" 
                    placeholder="Filtrer les POI..." 
                    className="w-full text-xs p-2 pl-7 border border-gray-300 rounded focus:border-blue-500 outline-none"
                    value={poiSearch}
                    onChange={(e) => setPoiSearch(e.target.value)}
                    disabled={isLoadingPois}
                />
                <Search className="w-3 h-3 absolute left-2 top-2.5 text-gray-400" />
            </div>

            {isLoadingPois ? (
                <div className="flex flex-col items-center justify-center p-4 text-gray-500 text-xs gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    <span>Recherche de lieux à proximité...</span>
                </div>
            ) : pois.length > 0 ? (
                <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
                    {filteredPois.length > 0 ? (
                        filteredPois.map(poi => (
                            <button 
                                key={poi.id} 
                                onClick={() => onPoiSelect(poi)}
                                className="w-full text-left flex items-start gap-2 p-1.5 hover:bg-white hover:shadow-sm rounded transition-all group"
                            >
                                <Target className="w-3 h-3 text-purple-400 mt-0.5 group-hover:text-purple-600" />
                                <div>
                                    <div className="text-xs font-medium text-gray-700 group-hover:text-purple-700">{poi.name}</div>
                                    <div className="text-[10px] text-gray-500">{poi.type}</div>
                                </div>
                            </button>
                        ))
                    ) : (
                        <div className="text-xs text-gray-500 p-2 text-center">Aucun POI trouvé pour cette recherche.</div>
                    )}
                </div>
            ) : (
                <p className="text-xs text-gray-500">Aucun POI majeur détecté pour le moment.</p>
            )}
          </section>
        )}

        {/* Story Configuration */}
        <section className="space-y-4 pt-4 border-t border-gray-100">
          <h2 className="font-bold text-gray-700 flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> L'Aventure
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Style</label>
              <select
                className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                value={config.style}
                onChange={(e) => setConfig({ ...config, style: e.target.value as StoryStyle })}
              >
                {Object.values(StoryStyle).map((style) => (
                  <option key={style} value={style}>{style}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Langue</label>
              <select
                className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                value={config.language}
                onChange={(e) => setConfig({ ...config, language: e.target.value as StoryLanguage })}
              >
                {Object.values(StoryLanguage).map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={() => onGenerateStory(config)}
            disabled={!start || !end || isGenerating}
            className={`w-full py-3 px-4 rounded-lg font-bold text-white flex items-center justify-center gap-2 shadow-md transition-all
              ${!start || !end 
                ? 'bg-gray-300 cursor-not-allowed' 
                : isGenerating 
                  ? 'bg-indigo-400 cursor-wait' 
                  : 'bg-indigo-600 hover:bg-indigo-700 active:transform active:scale-95'
              }`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Écriture en cours...
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5" /> Générer l'Histoire
              </>
            )}
          </button>
        </section>

        {/* Story Output */}
        {story && (
          <section className="mt-6 bg-indigo-50 p-4 rounded-xl border border-indigo-100 shadow-inner relative group">
             <div className="flex justify-between items-center mb-2">
                <h3 className="font-serif text-lg font-bold text-indigo-900">Votre Récit</h3>
                <div className="flex gap-2">
                    <button 
                        onClick={toggleSpeech}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors text-xs font-medium ${isSpeaking ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'}`}
                        title={isSpeaking ? "Arrêter la lecture" : "Écouter l'histoire"}
                    >
                        {isSpeaking ? (
                            <>
                                <StopCircle className="w-3.5 h-3.5 fill-current" />
                                <span>Arrêter</span>
                            </>
                        ) : (
                            <>
                                <Volume2 className="w-3.5 h-3.5" />
                                <span>Écouter</span>
                            </>
                        )}
                    </button>
                    <button 
                        onClick={handleShare}
                        className="p-1.5 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors"
                        title="Partager"
                    >
                        <Share2 className="w-4 h-4" />
                    </button>
                </div>
             </div>
            
            <div className="prose prose-sm prose-indigo text-gray-800 leading-relaxed font-serif whitespace-pre-line">
              {story}
            </div>
          </section>
        )}
      </div>
      
      <div className="p-3 border-t border-gray-200 text-center text-xs text-gray-400 bg-gray-50">
        Powered by OSM, Leaflet & Gemini API
      </div>
    </div>
  );
};

export default Sidebar;