export default function isIgnoredPackage(packageName: string, ignored: Readonly<string[]>): boolean {
    return ignored.includes(packageName);
}