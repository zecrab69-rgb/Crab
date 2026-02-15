import React, { useState, useEffect } from 'react';
import MapComponent from './components/MapComponent';
import Sidebar from './components/Sidebar';
import { Location, POI, StoryConfig, TransportMode } from './types';
import { getPOIs } from './services/osmService';
import { generateStoryStream } from './services/geminiService';

const App: React.FC = () => {
  const [start, setStart] = useState<Location | null>(null);
  const [end, setEnd] = useState<Location | null>(null);
  const [pois, setPois] = useState<POI[]>([]);
  const [focusedPoi, setFocusedPoi] = useState<POI | null>(null);
  const [selectionMode, setSelectionMode] = useState<'start' | 'end'>('start');
  const [story, setStory] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isLoadingPois, setIsLoadingPois] = useState<boolean>(false);
  const [transportMode, setTransportMode] = useState<TransportMode>('car');

  // Load state from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const startParam = params.get('start');
    const endParam = params.get('end');
    const modeParam = params.get('mode');

    if (startParam) {
        try {
            const [lat, lng, name] = startParam.split('|');
            setStart({ lat: parseFloat(lat), lng: parseFloat(lng), name: decodeURIComponent(name) });
        } catch(e) { console.error("Error parsing start param", e); }
    }
    if (endParam) {
        try {
            const [lat, lng, name] = endParam.split('|');
            setEnd({ lat: parseFloat(lat), lng: parseFloat(lng), name: decodeURIComponent(name) });
        } catch(e) { console.error("Error parsing end param", e); }
    }
    if (modeParam && ['car', 'bike', 'foot'].includes(modeParam)) {
        setTransportMode(modeParam as TransportMode);
    }
  }, []);

  // Update URL when state changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (start) params.set('start', `${start.lat}|${start.lng}|${encodeURIComponent(start.name)}`);
    if (end) params.set('end', `${end.lat}|${end.lng}|${encodeURIComponent(end.name)}`);
    if (transportMode) params.set('mode', transportMode);
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, [start, end, transportMode]);

  // Effect: Fetch POIs when destination changes
  useEffect(() => {
    const fetchPois = async () => {
      if (end) {
        setIsLoadingPois(true);
        try {
          // Search around the destination (2km radius)
          const newPois = await getPOIs(end.lat, end.lng, 2000);
          setPois(newPois);
        } catch (error) {
          console.error("Failed to fetch POIs", error);
          setPois([]);
        } finally {
          setIsLoadingPois(false);
        }
      } else {
        setPois([]);
      }
    };
    fetchPois();
  }, [end]);

  const handleGenerateStory = async (config: StoryConfig) => {
    if (!start || !end) return;

    setIsGenerating(true);
    setStory(''); // Reset story

    try {
      const responseStream = await generateStoryStream(start, end, pois, config);
      
      let fullStory = '';
      for await (const chunk of responseStream) {
        // Correctly access the text property from the chunk
        const text = chunk.text;
        if (text) {
            fullStory += text;
            setStory(fullStory); // Update UI in real-time
        }
      }

    } catch (error) {
      console.error("Story generation failed", error);
      setStory("Désolé, une erreur est survenue lors de la création de l'histoire. Veuillez vérifier votre clé API.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-gray-100 font-sans">
        {/* Sidebar container - Collapsible on mobile could be an enhancement, simplified here */}
        <div className="h-2/5 md:h-full md:w-[400px] flex-shrink-0 z-20">
            <Sidebar 
                start={start}
                end={end}
                pois={pois}
                setStart={setStart}
                setEnd={setEnd}
                selectionMode={selectionMode}
                setSelectionMode={setSelectionMode}
                onGenerateStory={handleGenerateStory}
                story={story}
                isGenerating={isGenerating}
                isLoadingPois={isLoadingPois}
                onPoiSelect={setFocusedPoi}
                transportMode={transportMode}
                setTransportMode={setTransportMode}
            />
        </div>

        {/* Map Container */}
        <div className="flex-1 h-3/5 md:h-full relative z-10">
            <MapComponent 
                start={start}
                end={end}
                pois={pois}
                focusedPoi={focusedPoi}
                setStart={setStart}
                setEnd={setEnd}
                selectionMode={selectionMode}
                setSelectionMode={setSelectionMode}
                transportMode={transportMode}
                setTransportMode={setTransportMode}
            />
        </div>
    </div>
  );
};

export default App;