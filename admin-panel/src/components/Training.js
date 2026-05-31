import { useEffect, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
  Play,
  BookOpen,
  Shield,
  Flame,
  HardHat
} from 'lucide-react';

function Training() {

  const role = localStorage.getItem("role");

  const [trainings, setTrainings] = useState([]);

  const [activeTraining, setActiveTraining] = useState(null);

  const [playVideo, setPlayVideo] = useState(false);

  const [selectedGallery, setSelectedGallery] = useState(null);

  const [videoModal, setVideoModal] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: ''
  });

  const [video, setVideo] = useState(null);

  const [banner, setBanner] = useState(null);

  // ================= FETCH =================

  const fetchTraining = async () => {

    try {

      const res = await axios.get(
        'https://safety-backend-h2y7.onrender.com/training'
      );

      setTrainings(res.data);

      if (res.data.length > 0) {
        setActiveTraining(res.data[0]);
      }

    } catch (err) {
      console.log(err);
    }

  };

  useEffect(() => {
    fetchTraining();
  }, []);

  // ================= ADMIN UPLOAD =================

  const uploadTraining = async () => {

    if (
      !form.title ||
      !form.description ||
      !form.category ||
      !video ||
      !banner
    ) {
      return alert('Fill all fields');
    }

    const formData = new FormData();

    formData.append('title', form.title);
    formData.append('description', form.description);
    formData.append('category', form.category);
    formData.append('video', video);
    formData.append('banner', banner);

    await axios.post(
      'https://safety-backend-h2y7.onrender.com/training',
      formData
    );

    alert('✅ Training Uploaded');

    setForm({
      title: '',
      description: '',
      category: ''
    });

    setVideo(null);
    setBanner(null);

    fetchTraining();

  };

  return (

    <div className="relative min-h-screen text-white overflow-hidden">

      {/* BACKGROUND */}

      <div className="fixed inset-0 bg-gradient-to-br from-[#020617] via-[#0f172a] to-black -z-10" />

      <div className="fixed top-0 right-0 w-[400px] h-[400px] bg-cyan-500 blur-[150px] opacity-20 -z-10" />

      {/* HERO SECTION */}

      {activeTraining && (

        <motion.div

          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}

          className="relative h-[500px] rounded-3xl overflow-hidden border border-white/10 shadow-2xl"

        >

          <img
            src={`https://safety-backend-h2y7.onrender.com/uploads/${activeTraining.banner}`}
            alt="banner"
            className="absolute inset-0 w-full h-full object-cover"
          />

          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />

          <div className="relative z-10 px-12 py-14 flex flex-col justify-center h-full max-w-[720px]">

            <div className="flex items-center gap-3 mb-4">

              <div className="bg-cyan-500/20 p-3 rounded-2xl backdrop-blur-xl border border-cyan-400/20">
                <Shield className="text-cyan-300" />
              </div>

               <div>

               <p className="text-cyan-300 font-semibold tracking-[4px] uppercase text-sm">
                Safety Training Program
               </p>

               <h3 className="text-white text-lg font-semibold mt-1">
                Safety Learning Platform
               </h3>

              </div>

            </div>

            <h1 className="text-5xl font-bold leading-tight mb-4">
              {activeTraining.title}
            </h1>

            <p className="text-gray-300 text-lg leading-relaxed mb-8">
              {activeTraining.description}
            </p>

            <div className="flex items-center gap-0">

<div className="p-0 bg-black/70 backdrop-blur-xl">


</div>

              <span className="bg-white/8 px-5 py-3 rounded-2xl border border-white/10 backdrop-blur-xl">
                {activeTraining.category}
              </span>

            </div>

          </div>

          {/* VIDEO PREVIEW */}

<div

  className="absolute right-10 bottom-10 w-[430px] rounded-[30px] overflow-hidden border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.4)] backdrop-blur-2xl bg-black/40"

  onMouseEnter={() => setPlayVideo(true)}

  onMouseLeave={() => setPlayVideo(false)}

>

  {/* VIDEO / IMAGE */}

  <div className="relative">

    {playVideo ? (

      <video

        src={`http://localhost:3000//uploads/${activeTraining.video}`}

        autoPlay

        muted

        loop

        controls

        className="w-full h-[250px] object-cover"

      />

    ) : (

      <img

        src={`https://localhost:3000/uploads/${activeTraining.banner}`}

        alt="training"

        className="w-full h-[250px] object-cover"

      />

    )}

  </div>

  {/* FOOTER */}

  <div className="p-5 bg-black/80 backdrop-blur-2xl">

<button

  onClick={() => setVideoModal(true)}

  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 py-3 rounded-2xl text-white font-semibold hover:scale-[1.02] transition"

>

      ▶ Watch Now

    </button>

  </div>

</div>

        </motion.div>

      )}

      {/* TRAINING CONCEPTS */}

      <div className="mt-10">

        <div className="flex items-center justify-between mb-6">

          <h2 className="text-3xl font-bold flex items-center gap-3">
            <BookOpen className="text-cyan-400" />
            Training Concepts
          </h2>

          <span className="text-gray-400">
            Hover concept cards to preview
          </span>

        </div>

        <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide">

          {trainings.map((item, index) => (

            <motion.div

              key={item._id || index}

              whileHover={{
                scale: 1.05,
                y: -5
              }}

              onMouseEnter={() => {

              setActiveTraining(item);

              setPlayVideo(true);

             }}
              onMouseLeave={() => {

               setPlayVideo(false);

             }}

              className="min-w-[320px] bg-white/5 border border-white/10 rounded-3xl overflow-hidden cursor-pointer backdrop-blur-xl shadow-2xl"

            >

              <div className="relative h-[180px] overflow-hidden">

                <img
                  src={`https://safety-backend-h2y7.onrender.com/uploads/${item.banner}`}
                  alt="training"
                  className="w-full h-full object-cover"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-xl px-3 py-1 rounded-full text-xs border border-white/10">
                  {item.category}
                </div>

                <div

  className="absolute bottom-4 left-4 bg-white/20 p-3 rounded-full backdrop-blur-xl border border-white/20 hover:scale-110 transition"

onClick={() => {

  setActiveTraining(item);

  setPlayVideo(true);

  setVideoModal(true);

}}

>
                  <Play
  fill="white"
  size={22}
  className="ml-1"
/>
                </div>

              </div>

              <div className="p-5">

                <h3 className="text-xl font-semibold mb-2">
                  {item.title}
                </h3>

                <p className="text-gray-400 text-sm line-clamp-3">
                  {item.description}
                </p>

              </div>

            </motion.div>

          ))}

        </div>

      </div>

{/* SAFETY AWARENESS GALLERY */}

<div className="mt-14">

  <div className="flex items-center justify-between mb-8">

    <h2 className="text-3xl font-bold flex items-center gap-3">

      <HardHat className="text-yellow-400" />

      Safety Awareness Gallery

    </h2>

    <span className="text-gray-400">

      Click images to preview

    </span>

  </div>

  <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide">

    {[1, 2, 3, 4, 5].map((item) => (

      <motion.div

        key={item}

        whileHover={{
          scale: 1.04,
          y: -6
        }}

        className="min-w-[380px] bg-white/5 rounded-[32px] overflow-hidden border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.3)] backdrop-blur-2xl"

      >

        {/* IMAGE */}

        <div className="relative">

          <img

            src={`/gallery/gallery${item}.jpg`}

            alt="gallery"

            className="w-full h-[240px] object-cover"

          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

          <div className="absolute bottom-5 left-5">

            <h3 className="text-xl font-semibold">

              Safety Awareness

            </h3>

            <p className="text-sm text-gray-300">

              Workplace safety training

            </p>

          </div>

        </div>

        {/* BUTTON */}

        <div className="p-5">

          <button

            onClick={() =>
              setSelectedGallery(
                `/gallery/gallery${item}.jpg`
              )
            }

            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 py-3 rounded-2xl font-semibold hover:scale-[1.02] transition"

          >

            🔍 Open Image

          </button>

        </div>

      </motion.div>

    ))}

  </div>

</div>

{/* GALLERY MODAL */}

{selectedGallery && (

  <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">

    <motion.div

      initial={{
        opacity: 0,
        scale: 0.8
      }}

      animate={{
        opacity: 1,
        scale: 1
      }}

      className="relative"

    >

      <img

        src={selectedGallery}

        alt="preview"

        className="max-h-[88vh] rounded-[32px] border border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.5)]"

      />

      <button

        onClick={() =>
          setSelectedGallery(null)
        }

        className="absolute top-5 right-5 bg-red-500 hover:bg-red-600 transition px-5 py-3 rounded-2xl font-semibold shadow-xl"

      >

        ✖ Close

      </button>

    </motion.div>

  </div>

)}
{/* VIDEO MODAL */}

{videoModal && activeTraining && (

  <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50">

    <motion.div

      initial={{
        opacity: 0,
        scale: 0.8
      }}

      animate={{
        opacity: 1,
        scale: 1
      }}

      className="relative w-[90%] max-w-[1200px]"

    >

      {/* VIDEO */}

      <video

        src={`https://safety-backend-h2y7.onrender.com/uploads/${activeTraining.video}`}

        controls

        autoPlay

        className="w-full max-h-[85vh] rounded-[32px] shadow-[0_0_60px_rgba(0,0,0,0.7)] border border-white/10"

      />

      {/* TITLE */}

      <div className="absolute bottom-6 left-6 bg-black/70 backdrop-blur-xl px-6 py-4 rounded-2xl border border-white/10">

        <h2 className="text-2xl font-bold text-white">
          {activeTraining.title}
        </h2>

        <p className="text-gray-300 mt-1">
          {activeTraining.category}
        </p>

      </div>

      {/* CLOSE */}

      <button

        onClick={() => setVideoModal(false)}

        className="absolute top-5 right-5 bg-red-500 hover:bg-red-600 transition px-5 py-3 rounded-2xl font-semibold shadow-2xl"

      >

        ✖ Close

      </button>

    </motion.div>

  </div>

)}

      {/* ADMIN PANEL */}

      {role === 'admin' && (

        <motion.div

          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}

          className="mt-14 bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl"

        >

          <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
            <Flame className="text-orange-400" />
            Upload New Training
          </h2>

          <div className="grid grid-cols-2 gap-5">

            <Input
              placeholder="Training Title"
              value={form.title}
              onChange={(v) =>
                setForm({
                  ...form,
                  title: v
                })
              }
            />

            <Input
              placeholder="Category"
              value={form.category}
              onChange={(v) =>
                setForm({
                  ...form,
                  category: v
                })
              }
            />

            <textarea
              placeholder="Training Description"
              value={form.description}
              onChange={(e) =>
                setForm({
                  ...form,
                  description: e.target.value
                })
              }
              className="col-span-2 bg-[#1f2937] border border-white/10 rounded-2xl p-4 min-h-[140px] text-white focus:outline-none focus:border-cyan-400"
            />

            <div className="bg-[#1f2937] rounded-2xl p-4 border border-white/10">
              <p className="text-sm text-gray-400 mb-2">
                Upload Banner Image
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setBanner(e.target.files[0])
                }
              />
            </div>

            <div className="bg-[#1f2937] rounded-2xl p-4 border border-white/10">
              <p className="text-sm text-gray-400 mb-2">
                Upload Training Video
              </p>
              <input
                type="file"
                accept="video/*"
                onChange={(e) =>
                  setVideo(e.target.files[0])
                }
              />
            </div>

          </div>

          <button
            onClick={uploadTraining}
            className="mt-8 w-full bg-gradient-to-r from-cyan-500 to-blue-600 py-4 rounded-2xl font-semibold text-lg hover:scale-[1.01] transition shadow-2xl"
          >
            🚀 Upload Training Concept
          </button>

        </motion.div>

      )}

    </div>

  );

}

// ================= INPUT =================

function Input({
  value,
  onChange,
  placeholder
}) {

  return (

    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) =>
        onChange(e.target.value)
      }
      className="bg-[#1f2937] border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-cyan-400"
    />

  );

}

export default Training;

