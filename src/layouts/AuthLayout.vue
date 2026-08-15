<template>
  <div class="flex min-h-screen flex-col bg-[#f4f7f5] lg:grid lg:grid-cols-2">
    <div class="relative h-48 sm:h-56 lg:h-auto">
      <img
        src="/bg.webp"
        alt="Tangub City Global College"
        class="absolute inset-0 h-full w-full object-cover"
      />
      <div class="absolute inset-0 bg-black/25"></div>

          <div class="absolute bottom-4 left-4 lg:bottom-10 lg:left-10">
            <h1 class="text-xl font-bold leading-tight text-white sm:text-3xl lg:text-5xl">
              Tangub City<br />
              Global College
            </h1>

            <p class="mt-1.5 hidden text-sm text-yellow-300 sm:mt-3 sm:block sm:text-base lg:mt-5 lg:text-lg">
              Light of the World.<br />
              <span class="font-semibold ">
                Your Access to Success.
              </span>
              <br>
              <span class="font-semibold">
                Integrity | Compassion | Excellence
              </span>
            </p>
          </div>
    </div>

    <div class="flex flex-1 lg:items-center sm:items-start justify-center px-6 py-8 sm:px-8 lg:py-16">
      <div class="w-full max-w-md">
        <RouterView />
      </div>
    </div>
  </div>
</template>
