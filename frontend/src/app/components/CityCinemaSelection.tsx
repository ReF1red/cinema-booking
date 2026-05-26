import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Building, CheckCircle2, ChevronRight, MapPin } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { fetchCinemasByCity, fetchCities, getErrorMessage } from "../../lib/api";
import type { Cinema, City } from "../../lib/types";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Chip } from "./ui/chip";

export function CityCinemaSelection() {
  const { user, selectedCity, selectedCinema, setSelectedCity, setSelectedCinema } = useApp();
  const navigate = useNavigate();

  const [cities, setCities] = useState<City[]>([]);
  const [cinemas, setCinemas] = useState<Cinema[]>([]);
  const [localCity, setLocalCity] = useState<number | null>(selectedCity);
  const [loadingCities, setLoadingCities] = useState(true);
  const [loadingCinemas, setLoadingCinemas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadCities = async () => {
      setLoadingCities(true);
      setError(null);
      try {
        const cityList = await fetchCities();
        if (!isMounted) {
          return;
        }
        setCities(cityList);
        const defaultCityId = selectedCity ?? cityList[0]?.city_id ?? null;
        setLocalCity(defaultCityId);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }
        setError(getErrorMessage(loadError, "Не удалось загрузить города."));
      } finally {
        if (isMounted) {
          setLoadingCities(false);
        }
      }
    };

    loadCities();

    return () => {
      isMounted = false;
    };
  }, [selectedCity]);

  useEffect(() => {
    if (!localCity) {
      setCinemas([]);
      return;
    }

    let isMounted = true;

    const loadCinemas = async () => {
      setLoadingCinemas(true);
      setError(null);
      try {
        const cinemaList = await fetchCinemasByCity(localCity);
        if (!isMounted) {
          return;
        }
        setCinemas(cinemaList);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }
        setError(getErrorMessage(loadError, "Не удалось загрузить кинотеатры."));
      } finally {
        if (isMounted) {
          setLoadingCinemas(false);
        }
      }
    };

    loadCinemas();

    return () => {
      isMounted = false;
    };
  }, [localCity]);

  const selectedCityName = useMemo(
    () => cities.find((city) => city.city_id === localCity)?.city_name ?? "",
    [cities, localCity],
  );

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const handleSelectCinema = (cinemaId: number) => {
    setSelectedCity(localCity);
    setSelectedCinema(cinemaId);
    setTimeout(() => navigate("/home"), 350);
  };

  return (
    <div className="flex-1 container mx-auto px-4 py-8 lg:py-16">
      <div className="max-w-3xl mx-auto space-y-12">
        <header className="space-y-4 text-center">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <MapPin className="w-12 h-12 text-[#E50914] mx-auto mb-4 box-glow rounded-full p-2 bg-[#E50914]/10" />
            <h1 className="text-4xl md:text-5xl font-heading text-white">Выберите локацию</h1>
            <p className="text-[#9CA3AF] text-lg mt-2">Найдите кинотеатры рядом с вами</p>
          </motion.div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-300">
            <p>{error}</p>
            <Button variant="outline" className="mt-3" onClick={() => window.location.reload()}>
              Обновить страницу
            </Button>
          </div>
        )}

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="space-y-6">
          <h2 className="text-xl font-heading text-[#FFC857] uppercase tracking-widest border-b border-[#F5F5F7]/10 pb-2">
            1. Выберите город
          </h2>
          {loadingCities ? (
            <div className="text-[#9CA3AF]">Загружаем список городов...</div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {cities.map((city) => (
                <Chip
                  key={city.city_id}
                  active={localCity === city.city_id}
                  onClick={() => setLocalCity(city.city_id)}
                  className="text-base py-2 px-6"
                >
                  {city.city_name}
                </Chip>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="space-y-6">
          <h2 className="text-xl font-heading text-[#FFC857] uppercase tracking-widest border-b border-[#F5F5F7]/10 pb-2">
            2. Выберите кинотеатр
          </h2>
          {loadingCinemas ? (
            <div className="text-[#9CA3AF]">Загружаем кинотеатры...</div>
          ) : cinemas.length === 0 ? (
            <Card className="bg-[#1A1A1F] border-[#F5F5F7]/10 p-8 text-center text-[#9CA3AF]">
              Для выбранного города пока нет доступных кинотеатров.
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {cinemas.map((cinema, index) => {
                const isSelected = selectedCinema === cinema.cinema_id;
                return (
                  <motion.div
                    key={cinema.cinema_id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 + index * 0.08 }}
                  >
                    <Card
                      className={`cursor-pointer group transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(229,9,20,0.15)] ${
                        isSelected ? "border-[#E50914] bg-[#E50914]/5" : "border-[#F5F5F7]/10 bg-[#1A1A1F]"
                      }`}
                      onClick={() => handleSelectCinema(cinema.cinema_id)}
                    >
                      <div className="p-6 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                              isSelected
                                ? "bg-[#E50914] text-white box-glow"
                                : "bg-[#232329] text-[#9CA3AF] group-hover:text-[#F5F5F7]"
                            }`}
                          >
                            <Building className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg text-[#F5F5F7]">{cinema.cinema_name}</h3>
                            <p className="text-[#9CA3AF] text-sm flex items-center gap-1 mt-1">
                              <MapPin className="w-3 h-3" />
                              {selectedCityName}
                            </p>
                          </div>
                        </div>

                        {isSelected ? (
                          <CheckCircle2 className="w-6 h-6 text-[#E50914]" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-[#9CA3AF] group-hover:text-[#E50914] transition-colors group-hover:translate-x-1" />
                        )}
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
