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
    <main
      id="main-content"
      className="min-h-svh grid content-start bg-paper tablet:content-center tablet:py-8 tablet:px-0"
    >
      <div className="flex items-center pt-[calc(1rem_+_env(safe-area-inset-top))] pb-4 font-serif font-bold px-[1.2rem] gap-[0.55rem] tablet:fixed tablet:top-0 tablet:left-0">
        <span className="grid place-items-center rounded-full bg-sunshine size-8">
          <PawPrint size={17} />
        </span>{' '}
        Pawprint
      </div>
      <div className="w-[min(100%,_590px)] pt-[1.2rem] pb-8 my-0 mx-auto px-4 tablet:pt-8 tablet:rounded-[28px] tablet:bg-cream tablet:shadow-card tablet:px-8 tablet:border tablet:border-line">
        <div
          className="grid grid-cols-[1fr_1fr] mb-8 gap-[0.35rem]"
          aria-label={`Step ${step} of 2`}
        >
          <span
            className="h-1 rounded-full bg-[#d8dee1] data-[active=true]:bg-sunshine-deep"
            data-active="true"
          />
          <span
            className="h-1 rounded-full bg-[#d8dee1] data-[active=true]:bg-sunshine-deep"
            data-active={step === 2}
          />
        </div>
        {step === 1 ? (
          <section>
            <p className="flex items-center mb-[0.45rem] text-[#67717e] text-[0.72rem] font-extrabold tracking-[0.14em] uppercase gap-[0.4rem]">
              <Sparkles size={14} /> A new life book
            </p>
            <h1 className="mb-4">
              Who are we
              <br />
              remembering?
            </h1>
            <p className="text-ink-soft text-[1.05rem] leading-[1.65]">
              Start with the face and name that make your phone light up.
            </p>
            <label className="grid place-items-center w-full min-h-[142px] overflow-hidden rounded-[24px_24px_19px_19px] bg-[#e9eff1] cursor-pointer my-[1.2rem] mx-0 border border-[#9eabb1] border-dashed">
              <input
                className="absolute opacity-0 size-px"
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
                <img
                  className="w-full h-[210px] object-cover"
                  src={photoPreview}
                  alt="Selected pet profile"
                />
              ) : (
                <span className="grid justify-items-center text-ink-soft gap-1">
                  <Camera size={25} />
                  <b>Add a favorite photo</b>
                  <small className="text-[0.68rem]">JPG, PNG, WebP or HEIC · up to 8 MB</small>
                </span>
              )}
            </label>
            {photoError && (
              <p
                className="mt-[-0.55rem] mb-[0.7rem] text-[#a03d30] text-[0.78rem] font-bold mx-0"
                role="alert"
              >
                {photoError}
              </p>
            )}
            <label className="grid mb-[0.9rem] gap-[0.4rem]">
              <span className="text-[0.78rem] font-extrabold text-[#435066]">Name</span>
              <input
                className="w-full min-h-12.5 rounded-[13px] bg-white text-ink py-3 px-[0.85rem] border border-[#cfd7db] focus:outline-3 focus:outline-solid focus:outline-[rgba(159,_201,_212,_0.45)] focus:border-[#748995]"
                autoComplete="off"
                placeholder="e.g. Juniper"
                {...register('name')}
              />
            </label>
            {errors.name && (
              <p
                className="mt-[-0.55rem] mb-[0.7rem] text-[#a03d30] text-[0.78rem] font-bold mx-0"
                role="alert"
              >
                {errors.name.message}
              </p>
            )}
            <fieldset className="mt-0 mb-[1.1rem] mx-0 p-0 border-0">
              <legend className="text-[0.78rem] font-extrabold text-[#435066] mb-[0.4rem]">
                Species
              </legend>
              <div className="grid grid-cols-[repeat(3,_1fr)] gap-[0.45rem]">
                {(['dog', 'cat', 'other'] as const).map((species) => (
                  <label className="relative" key={species}>
                    <input
                      className="peer absolute opacity-0"
                      type="radio"
                      value={species}
                      {...register('species')}
                    />
                    <span className="min-h-12 grid place-items-center rounded-[13px] bg-white font-bold border border-[#cfd7db] peer-checked:bg-ink peer-checked:text-white peer-checked:border-ink">
                      {species === 'dog' ? 'Dog' : species === 'cat' ? 'Cat' : 'Other'}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              className="min-h-11.5 inline-flex items-center justify-center rounded-[14px] font-extrabold cursor-pointer bg-sunshine w-full py-[0.6rem] px-4 gap-[0.45rem] border border-[#d1a51a] disabled:opacity-45 disabled:cursor-not-allowed"
              type="button"
              disabled={!name?.trim()}
              onClick={() => setStep(2)}
            >
              Continue <span aria-hidden>→</span>
            </button>
          </section>
        ) : (
          <form onSubmit={onSubmit}>
            <button
              className="min-h-11 inline-flex items-center mb-[0.7rem] bg-transparent font-extrabold cursor-pointer p-0 gap-1 border-0"
              type="button"
              onClick={() => setStep(1)}
            >
              <ChevronLeft size={18} /> Back
            </button>
            <p className="flex items-center mb-[0.45rem] text-[#67717e] text-[0.72rem] font-extrabold tracking-[0.14em] uppercase gap-[0.4rem]">
              A few more details
            </p>
            <h1 className="mb-4">
              Tell us about
              <br />
              {name || 'your pet'}.
            </h1>
            <p className="text-ink-soft text-[1.05rem] leading-[1.65]">
              You can change any of this later.
            </p>
            <label className="grid mb-[0.9rem] gap-[0.4rem]">
              <span className="text-[0.78rem] font-extrabold text-[#435066]">
                Breed <small className="text-[#87909a] font-medium">optional</small>
              </span>
              <input
                className="w-full min-h-12.5 rounded-[13px] bg-white text-ink py-3 px-[0.85rem] border border-[#cfd7db] focus:outline-3 focus:outline-solid focus:outline-[rgba(159,_201,_212,_0.45)] focus:border-[#748995]"
                placeholder="e.g. Golden retriever"
                {...register('breed')}
              />
            </label>
            <div className="grid grid-cols-[1fr_1fr] gap-[0.7rem] [@media(width<=370px)]:grid-cols-[1fr] [@media(width<=370px)]:gap-0">
              <label className="grid mb-[0.9rem] gap-[0.4rem]">
                <span className="text-[0.78rem] font-extrabold text-[#435066]">Birthday</span>
                <input
                  className="w-full min-h-12.5 rounded-[13px] bg-white text-ink py-3 px-[0.85rem] border border-[#cfd7db] focus:outline-3 focus:outline-solid focus:outline-[rgba(159,_201,_212,_0.45)] focus:border-[#748995]"
                  type="date"
                  {...register('birthDate')}
                />
              </label>
              <label className="grid mb-[0.9rem] gap-[0.4rem]">
                <span className="text-[0.78rem] font-extrabold text-[#435066]">Or age</span>
                <input
                  className="w-full min-h-12.5 rounded-[13px] bg-white text-ink py-3 px-[0.85rem] border border-[#cfd7db] focus:outline-3 focus:outline-solid focus:outline-[rgba(159,_201,_212,_0.45)] focus:border-[#748995]"
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
              <p
                className="mt-[-0.55rem] mb-[0.7rem] text-[#a03d30] text-[0.78rem] font-bold mx-0"
                role="alert"
              >
                {errors.birthDate.message}
              </p>
            )}
            <label className="min-h-11 flex items-center mt-[-0.2rem] mb-4 text-[0.85rem] mx-0 gap-[0.6rem]">
              <input
                className="accent-ink size-5"
                type="checkbox"
                {...register('approximateBirthDate')}
              />
              <span>This date is approximate</span>
            </label>
            <div className="grid grid-cols-[1fr_92px] gap-[0.7rem] [@media(width<=370px)]:grid-cols-[1fr_86px] [@media(width<=370px)]:gap-[0.6rem]">
              <label className="grid mb-[0.9rem] gap-[0.4rem]">
                <span className="text-[0.78rem] font-extrabold text-[#435066]">
                  Current weight <small className="text-[#87909a] font-medium">optional</small>
                </span>
                <input
                  className="w-full min-h-12.5 rounded-[13px] bg-white text-ink py-3 px-[0.85rem] border border-[#cfd7db] focus:outline-3 focus:outline-solid focus:outline-[rgba(159,_201,_212,_0.45)] focus:border-[#748995]"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  placeholder="0.0"
                  {...register('currentWeight')}
                />
              </label>
              <label className="grid mb-[0.9rem] gap-[0.4rem]">
                <span className="text-[0.78rem] font-extrabold text-[#435066]">Unit</span>
                <select
                  className="w-full min-h-12.5 rounded-[13px] bg-white text-ink py-3 px-[0.85rem] border border-[#cfd7db] focus:outline-3 focus:outline-solid focus:outline-[rgba(159,_201,_212,_0.45)] focus:border-[#748995]"
                  {...register('weightUnit')}
                >
                  <option value="kg">kg</option>
                  <option value="lb">lb</option>
                </select>
              </label>
            </div>
            <button
              className="min-h-11.5 inline-flex items-center justify-center rounded-[14px] font-extrabold cursor-pointer bg-sunshine w-full py-[0.6rem] px-4 gap-[0.45rem] border border-[#d1a51a] disabled:opacity-45 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Making the book…' : `Start ${name || 'our'}’s book`}{' '}
              <PawPrint size={18} />
            </button>
            <p className="mt-4 mb-0 max-w-[360px] text-[#79838e] text-center text-[0.72rem] mx-auto">
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
