<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
</script>

<svelte:head>
	<title>Sylvan Web - Privacy Policy</title>
</svelte:head>

<div class="mx-auto max-w-7xl p-6">
	<h1 class="mb-6 text-2xl font-semibold tracking-tight text-emerald-400">Privacy Policy</h1>

	<div class="space-y-6 text-zinc-300">
		<p class="text-sm text-zinc-500">Last updated: {new Date().toLocaleDateString()}</p>

		<section>
			<h2 class="mb-2 text-lg font-semibold text-emerald-400">1. Information We Collect</h2>
			<p class="mb-2">We collect the following information:</p>
			<ul class="list-inside list-disc space-y-1 text-zinc-400">
				<li>Account information (email, name) through Clerk authentication</li>
				<li>Your Magic: The Gathering card wishlists and collections</li>
				<li>Basic usage analytics to improve the service</li>
			</ul>
		</section>

		<section>
			<h2 class="mb-2 text-lg font-semibold text-emerald-400">2. How We Use Your Information</h2>
			<p class="mb-2">We use your information to:</p>
			<ul class="list-inside list-disc space-y-1 text-zinc-400">
				<li>Provide and maintain the Sylvan Web service</li>
				<li>Match you with potential trade partners</li>
				<li>Save and display your wishlists and collections</li>
				<li>Improve our features and user experience</li>
			</ul>
		</section>

		<section>
			<h2 class="mb-2 text-lg font-semibold text-emerald-400">3. Data Storage</h2>
			<p>
				Your data is stored securely using Supabase. Wishlists marked as public are visible to other
				users. Private wishlists are only visible to you.
			</p>
		</section>

		<section>
			<h2 class="mb-2 text-lg font-semibold text-emerald-400">4. Data Sharing</h2>
			<p>We do not sell your personal information. We only share data with:</p>
			<ul class="list-inside list-disc space-y-1 text-zinc-400">
				<li>Clerk (authentication provider) - for account management</li>
				<li>Supabase (database provider) - for data storage</li>
				<li>Scryfall API - for card data lookup (anonymized requests)</li>
			</ul>
		</section>

		<section>
			<h2 class="mb-2 text-lg font-semibold text-emerald-400">5. Your Rights</h2>
			<p>You have the right to:</p>
			<ul class="list-inside list-disc space-y-1 text-zinc-400">
				<li>Access your personal data</li>
				<li>Delete your account and associated data</li>
				<li>Export your wishlists and collections</li>
				<li>Update your profile information</li>
			</ul>
		</section>

		<section>
			<h2 class="mb-2 text-lg font-semibold text-emerald-400">6. Data Retention</h2>
			<p>
				We retain your data for as long as your account is active. When you delete your account, we
				remove your personal information within 30 days.
			</p>
		</section>

		<section>
			<h2 class="mb-2 text-lg font-semibold text-emerald-400">7. Security</h2>
			<p>
				We use industry-standard security measures including encryption and secure authentication.
				However, no internet transmission is completely secure, and we cannot guarantee absolute
				security.
			</p>
		</section>

		<section>
			<h2 class="mb-2 text-lg font-semibold text-emerald-400">8. Changes to Privacy Policy</h2>
			<p>
				We may update this privacy policy from time to time. We will notify you of any material
				changes by posting the new policy on this page.
			</p>
		</section>

		<section>
			<h2 class="mb-2 text-lg font-semibold text-emerald-400">9. Contact</h2>
			<p>
				For privacy-related questions or requests, please contact us through the app's feedback
				channels.
			</p>
		</section>
	</div>
</div>
