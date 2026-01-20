import React, { useState, useEffect } from "react";
import { useLocation, useParams } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import LanguageToggle from "./LanguageToggle";
import { translations } from "./translations";

export default function ThankYou() {
  const { id } = useParams();
  const location = useLocation();
  const [language, setLanguage] = useState<
    "en" | "ru" | "fr" | "es"
  >(location.state?.language || "en");
  
  const [thankYouMessage, setThankYouMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const t =
    translations[language]?.thankYou ||
    translations.en.thankYou;

  useEffect(() => {
    const loadSurveyMessage = async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from("surveys")
          .select("thank_you_message")
          .eq("id", id)
          .single();
        
        if (error && error.code !== "42703" && error.code !== "PGRST116") {
          console.error("Error loading survey:", error);
        }
        
        if (data?.thank_you_message) {
          setThankYouMessage(data.thank_you_message);
        }
      } catch (error) {
        console.error("Error loading survey message:", error);
      } finally {
        setLoading(false);
      }
    };
    
    loadSurveyMessage();
  }, [id]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      {/* Language Toggle */}
      <div className="fixed top-6 right-6">
        <LanguageToggle
          currentLanguage={language}
          onLanguageChange={setLanguage}
        />
      </div>

      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 md:p-12 text-center">
          {/* Success Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-50 rounded-full mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>

          {/* Thank You Message */}
          <h1 className="text-3xl font-semibold text-gray-900 mb-4">
            {t.title}
          </h1>

          <p className="text-gray-600 leading-relaxed mb-6">
            {thankYouMessage || t.description}
          </p>

          {/* Additional Info */}
          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 text-left">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              {t.nextStepsTitle}
            </h3>
            <ul className="space-y-2 text-sm text-gray-600">
              {t.nextSteps.map((step, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2"
                >
                  <span className="text-indigo-600 mt-0.5">
                    •
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer */}
          <p className="text-sm text-gray-500 mt-8">
            {language === 'ru' ? (
              <>
                Теперь вы можете <strong>закрыть</strong> это окно
              </>
            ) : language === 'fr' ? (
              <>
                Vous pouvez maintenant <strong>fermer</strong> cette fenêtre
              </>
            ) : language === 'es' ? (
              <>
                Ahora puede <strong>cerrar</strong> esta ventana
              </>
            ) : (
              <>
                You may now <strong>close</strong> this window
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}