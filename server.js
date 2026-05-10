const multer = require("multer");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Work = require("./models/Work");
const User = require("./models/User");
const Hazard = require("./models/Hazard");
const Training = require("./models/Training");

const app = express();

// ================= MIDDLEWARE =================

app.use(express.json());

app.use(cors());

app.use(
  "/uploads",
  express.static("uploads")
);

// ================= DATABASE =================

mongoose.connect(
  "mongodb://127.0.0.1:27017/safetyApp"
)

.then(() => {

  console.log(
    "✅ MongoDB Connected"
  );

})

.catch((err) => {

  console.log(err);

});

// ================= JWT =================

const verifyToken = (
  req,
  res,
  next
) => {

  const header =
    req.headers.authorization;

  if (!header) {

    return res
      .status(401)
      .send("No token");

  }

  const token =
    header.split(" ")[1];

  try {

    const decoded =
      jwt.verify(
        token,
        "secret"
      );

    req.user = decoded;

    next();

  } catch {

    res
      .status(401)
      .send("Invalid token");

  }

};

// ================= MULTER =================

const storage =
  multer.diskStorage({

    destination:
      "uploads/",

    filename: (
      req,
      file,
      cb
    ) => {

      cb(
        null,
        Date.now() +
          "-" +
          file.originalname
      );

    }

  });

const upload =
  multer({
    storage
  });

const trainingUpload =
  multer({
    storage
  });

const profileUpload =
  multer({
    storage
  });

// ================= REGISTER =================

app.post(
  "/register",
  async (req, res) => {

    try {

      const existing =
        await User.findOne({

          email:
            req.body.email

        });

      if (existing) {

        return res.send(
          "User already exists"
        );

      }

      const hashed =
        await bcrypt.hash(

          req.body.password,

          10

        );

      const user =
        new User({

          name:
            req.body.name,

          email:
            req.body.email,

          mobile:
            req.body.mobile,

          password:
            hashed,

          role:
            req.body.role,

          profileImage: ""

        });

      await user.save();

      res.send(
        "✅ User Created"
      );

    } catch (err) {

      console.log(err);

      res
        .status(500)
        .send(
          "Registration failed"
        );

    }

  }
);

// ================= LOGIN =================

app.post(
  "/login",
  async (req, res) => {

    try {

      const user =
        await User.findOne({

          email:
            req.body.email

        });

      if (!user) {

        return res
          .status(404)
          .send(
            "User not found"
          );

      }

      const valid =
        await bcrypt.compare(

          req.body.password,

          user.password

        );

      if (!valid) {

        return res
          .status(401)
          .send(
            "Wrong password"
          );

      }

      const token =
        jwt.sign(

          {
            id: user._id,
            role: user.role
          },

          "secret"

        );

      res.json({

        token,

        id: user._id,

        role: user.role,

        name: user.name,

        email: user.email,

        mobile: user.mobile,

        profileImage:
          user.profileImage || ""

      });

    } catch (err) {

      console.log(err);

      res
        .status(500)
        .send(
          "Login failed"
        );

    }

  }
);

// ================= CREATE ADMIN =================

app.get(
  "/create-admin",
  async (req, res) => {

    try {

      const existing =
        await User.findOne({

          email:
            "admin@gmail.com"

        });

      if (existing) {

        return res.send(
          "Admin already exists"
        );

      }

      const hashed =
        await bcrypt.hash(
          "admin123",
          10
        );

      const admin =
        new User({

          name: "Admin",

          email:
            "admin@gmail.com",

          mobile:
            "9876543210",

          password:
            hashed,

          role: "admin",

          profileImage: ""

        });

      await admin.save();

      res.send(
        "✅ Admin Created"
      );

    } catch (err) {

      console.log(err);

      res
        .status(500)
        .send(
          "Admin creation failed"
        );

    }

  }
);

// ================= PROFILE UPDATE =================

app.put(

  "/users/:id",

  async (req, res) => {

    try {

      const updateData = {

        name: req.body.name,

        email: req.body.email,

        mobile: req.body.mobile,

        role: req.body.role

      };

      // PASSWORD UPDATE

      if (
        req.body.password &&
        req.body.password.trim() !== ""
      ) {

        const hashed =
          await bcrypt.hash(

            req.body.password,

            10

          );

        updateData.password =
          hashed;

      }

      await User.findByIdAndUpdate(

        req.params.id,

        updateData

      );

      res.send(
        "✅ User Updated"
      );

    } catch (err) {

      console.log(err);

      res.status(500).send(
        "Update failed"
      );

    }

  }

);

// ================= USERS =================

app.get(
  "/users",
  async (req, res) => {

    const users =
      await User.find()
      .select("-password");

    res.json(users);

  }
);

app.put(
  "/users/:id",
  async (req, res) => {

    await User.findByIdAndUpdate(

      req.params.id,

      req.body

    );

    res.send(
      "User Updated"
    );

  }
);

app.delete(
  "/users/:id",
  async (req, res) => {

    await User.findByIdAndDelete(
      req.params.id
    );

    res.send(
      "User Deleted"
    );

  }
);

// ================= WORK =================

app.post(
  '/work',
  upload.single('beforeImage'),
  async (req, res) => {

    try {

      const work = new Work({

        workType:
          req.body.workType,

        location:
          req.body.location,

        workersCount:
          req.body.workersCount,

        beforeImage:
          req.file
            ? req.file.filename
            : "",

        status: "Pending"

      });

      await work.save();

      res.send(
        "Work Submitted"
      );

    } catch (err) {

      console.log(err);

      res.status(500).send(
        "Submit Failed"
      );

    }

  }
);

app.get(
  "/work",
  async (req, res) => {

    const data =
      await Work.find();

    res.json(data);

  }
);

app.put(
  "/work/:id",
  async (req, res) => {

    await Work.findByIdAndUpdate(

      req.params.id,

      {
        status:
          req.body.status
      }

    );

    res.send("Updated");

  }
);

app.put(

  "/work/complete/:id",

  upload.single(
    "afterImage"
  ),

  async (req, res) => {

    await Work.findByIdAndUpdate(

      req.params.id,

      {

        afterImage:
          req.file.filename,

        status:
          "Completed"

      }

    );

    res.send(
      "Completed"
    );

  }

);

app.delete(
  "/work/:id",
  async (req, res) => {

    await Work.findByIdAndDelete(
      req.params.id
    );

    res.send("Deleted");

  }
);

// ================= HAZARD =================

app.post(

  "/hazard",

  upload.fields([

    {
      name: "beforeImage"
    },

    {
      name: "afterImage"
    }

  ]),

  async (req, res) => {

    const hazard =
      new Hazard({

        ...req.body,

        beforeImage:
          req.files[
            "beforeImage"
          ]?.[0]?.filename,

        afterImage:
          req.files[
            "afterImage"
          ]?.[0]?.filename,

        status: "Open"

      });

    await hazard.save();

    res.send(
      "Hazard Created"
    );

  }

);

app.get(
  "/hazard",
  async (req, res) => {

    const data =
      await Hazard.find();

    res.json(data);

  }
);

app.put(

  "/hazard/close/:id",

  upload.single(
    "afterImage"
  ),

  async (req, res) => {

    await Hazard.findByIdAndUpdate(

      req.params.id,

      {

        afterImage:
          req.file.filename,

        status:
          "Closed"

      }

    );

    res.send("Closed");

  }

);

app.delete(
  "/hazard/:id",
  async (req, res) => {

    await Hazard.findByIdAndDelete(
      req.params.id
    );

    res.send("Deleted");

  }
);

// ================= REPORTS =================

app.get(
  "/reports/work",
  async (req, res) => {

    try {

      const data =
        await Work.find()
        .sort({
          createdAt: -1
        });

      res.json(data);

    } catch {

      res
        .status(500)
        .send(
          "Work report failed"
        );

    }

  }
);

app.get(
  "/reports/hazard",
  async (req, res) => {

    try {

      const data =
        await Hazard.find()
        .sort({
          createdAt: -1
        });

      res.json(data);

    } catch {

      res
        .status(500)
        .send(
          "Hazard report failed"
        );

    }

  }
);

// ================= TRAINING UPLOAD =================

app.post(

  "/training",

  trainingUpload.fields([

    {
      name: "banner",
      maxCount: 1
    },

    {
      name: "video",
      maxCount: 1
    }

  ]),

  async (req, res) => {

    try {

      const training =
        new Training({

          title:
            req.body.title,

          description:
            req.body.description,

          category:
            req.body.category,

          banner:
            req.files.banner?.[0]
              ?.filename,

          video:
            req.files.video?.[0]
              ?.filename

        });

      await training.save();

      res.json({
        success: true
      });

    } catch (err) {

      console.log(err);

      res
        .status(500)
        .json({

          error:
            "Training upload failed"

        });

    }

  }

);

// ================= GET TRAINING =================

app.get(
  "/training",
  async (req, res) => {

    try {

      const data =
        await Training.find()
        .sort({
          createdAt: -1
        });

      res.json(data);

    } catch {

      res
        .status(500)
        .json({

          error:
            "Fetch failed"

        });

    }

  }
);

// ================= ROOT =================

app.get("/", (req, res) => {

  res.send(
    "🚀 Backend Running"
  );

});

// ================= SERVER =================

app.listen(5000, () => {

  console.log(
    "🔥 Server running on port 5000"
  );

});