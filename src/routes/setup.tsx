import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Camera, ChevronLeft, PawPrint, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { saveMedia, savePet } from '../lib/local-db'
import { petSchema, validatePhoto } from '../lib/schemas'

export const Route = createFileRoute('/setup')({ component: SetupRoute })
type PetForm = z.input<typeof petSchema>

function SetupRoute() {
  const navigate = useNavigate()
  const [photo, setPhoto] = useState<File>()
  const [photoPreview, setPhotoPreview] = useState<string>()
  const [photoError, setPhotoError] = useState<string>()
  const [step, setStep] = useState(1)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PetForm>({
    resolver: zodResolver(petSchema),
    defaultValues: { species: 'dog', weightUnit: 'kg', approximateBirthDate: false },
  })
  const name = watch('name')

  const onSubmit = handleSubmit(async (values) => {
    const parsed = petSchema.parse(values)
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const birthDate =
      parsed.birthDate ||
      (parsed.ageYears !== '' && parsed.ageYears !== undefined
        ? new Date(new Date().setFullYear(new Date().getFullYear() - Number(parsed.ageYears)))
            .toISOString()
            .slice(0, 10)
        : undefined)
    let avatarUrl = photoPreview
    if (photo && !avatarUrl) avatarUrl = await readFile(photo)
    await savePet({
      id,
      name: parsed.name,
      species: parsed.species,
      breed: parsed.breed || undefined,
      birthDate,
      approximateBirthDate: parsed.approximateBirthDate || Boolean(parsed.ageYears),
      currentWeight: parsed.currentWeight === '' ? undefined : parsed.currentWeight,
      weightUnit: parsed.weightUnit,
      avatarUrl,
      createdAt: now,
      updatedAt: now,
    })
    if (photo)
      await saveMedia({
        id: crypto.randomUUID(),
        petId: id,
        mimeType: photo.type,
        blob: photo,
        localUrl: avatarUrl,
        createdAt: now,
        syncState: 'pending',
      })
    await navigate({ to: '/pets/$petId', params: { petId: id }, replace: true })
  })

  return (
    <main id="main-content" className="setup-page">
      <div className="setup-brand">
        <span>
          <PawPrint size={17} />
        </span>{' '}
        Pawprint
      </div>
      <div className="setup-card">
        <div className="step-row" aria-label={`Step ${step} of 2`}>
          <span className="active" />
          <span className={step === 2 ? 'active' : ''} />
        </div>
        {step === 1 ? (
          <section className="setup-step">
            <p className="eyebrow">
              <Sparkles size={14} /> A new life book
            </p>
            <h1>
              Who are we
              <br />
              remembering?
            </h1>
            <p className="lede">Start with the face and name that make your phone light up.</p>
            <label className="photo-picker">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                capture="environment"
                onChange={async (event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  const error = validatePhoto(file)
                  setPhotoError(error ?? undefined)
                  if (!error) {
                    setPhoto(file)
                    setPhotoPreview(await readFile(file))
                  }
                }}
              />
              {photoPreview ? (
                <img src={photoPreview} alt="Selected pet profile" />
              ) : (
                <span>
                  <Camera size={25} />
                  <b>Add a favorite photo</b>
                  <small>JPG, PNG, WebP or HEIC · up to 8 MB</small>
                </span>
              )}
            </label>
            {photoError && (
              <p className="field-error" role="alert">
                {photoError}
              </p>
            )}
            <label className="field">
              <span>Name</span>
              <input autoComplete="off" placeholder="e.g. Juniper" {...register('name')} />
            </label>
            {errors.name && (
              <p className="field-error" role="alert">
                {errors.name.message}
              </p>
            )}
            <fieldset className="segmented-field">
              <legend>Species</legend>
              <div>
                {(['dog', 'cat', 'other'] as const).map((species) => (
                  <label key={species}>
                    <input type="radio" value={species} {...register('species')} />
                    <span>{species === 'dog' ? 'Dog' : species === 'cat' ? 'Cat' : 'Other'}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              className="primary-button full"
              type="button"
              disabled={!name?.trim()}
              onClick={() => setStep(2)}
            >
              Continue <span aria-hidden>→</span>
            </button>
          </section>
        ) : (
          <form className="setup-step" onSubmit={onSubmit}>
            <button className="back-button" type="button" onClick={() => setStep(1)}>
              <ChevronLeft size={18} /> Back
            </button>
            <p className="eyebrow">A few more details</p>
            <h1>
              Tell us about
              <br />
              {name || 'your pet'}.
            </h1>
            <p className="lede">You can change any of this later.</p>
            <label className="field">
              <span>
                Breed <small>optional</small>
              </span>
              <input placeholder="e.g. Golden retriever" {...register('breed')} />
            </label>
            <div className="field-pair">
              <label className="field">
                <span>Birthday</span>
                <input type="date" {...register('birthDate')} />
              </label>
              <label className="field">
                <span>Or age</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="80"
                  placeholder="Years"
                  {...register('ageYears')}
                />
              </label>
            </div>
            {errors.birthDate && (
              <p className="field-error" role="alert">
                {errors.birthDate.message}
              </p>
            )}
            <label className="check-field">
              <input type="checkbox" {...register('approximateBirthDate')} />
              <span>This date is approximate</span>
            </label>
            <div className="field-pair weight-pair">
              <label className="field">
                <span>
                  Current weight <small>optional</small>
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  placeholder="0.0"
                  {...register('currentWeight')}
                />
              </label>
              <label className="field">
                <span>Unit</span>
                <select {...register('weightUnit')}>
                  <option value="kg">kg</option>
                  <option value="lb">lb</option>
                </select>
              </label>
            </div>
            <button className="primary-button full" disabled={isSubmitting}>
              {isSubmitting ? 'Making the book…' : `Start ${name || 'our'}’s book`}{' '}
              <PawPrint size={18} />
            </button>
            <p className="privacy-note">
              Your memories stay on this device until they sync to your Pawprint database.
            </p>
          </form>
        )}
      </div>
    </main>
  )
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
