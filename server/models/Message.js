import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema(
  {
    pseudo: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 400,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
)

export const Message = mongoose.model('Message', messageSchema)
